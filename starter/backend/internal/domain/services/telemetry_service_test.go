package services_test

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockUsageLogRepo captura inserts de forma thread-safe.
type mockUsageLogRepo struct {
	mu      sync.Mutex
	entries []models.AiUsageLog
	errOnN  int // fallo en el N-ésimo Create (1-based); 0 = nunca
	calls   atomic.Int32
	delay   time.Duration
	blockCh chan struct{} // si no nil, Create espera hasta cerrar/recibir
}

func (m *mockUsageLogRepo) Create(ctx context.Context, entry *models.AiUsageLog) error {
	n := int(m.calls.Add(1))
	if m.blockCh != nil {
		select {
		case <-m.blockCh:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	if m.delay > 0 {
		select {
		case <-time.After(m.delay):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	if m.errOnN > 0 && n == m.errOnN {
		return errors.New("simulated db error")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := *entry
	m.entries = append(m.entries, cp)
	return nil
}

func (m *mockUsageLogRepo) Count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.entries)
}

func (m *mockUsageLogRepo) Snapshot() []models.AiUsageLog {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]models.AiUsageLog, len(m.entries))
	copy(out, m.entries)
	return out
}

func TestTelemetry_LogSync(t *testing.T) {
	t.Parallel()
	repo := &mockUsageLogRepo{}
	svc := services.NewTelemetryServiceWithRepo(repo, 8)
	defer svc.Close()

	uid := uuid.New()
	err := svc.LogSync(context.Background(), uid, "SUPER_ADMIN", models.TelemetryAskCopilot)
	require.NoError(t, err)
	assert.Equal(t, 1, repo.Count())
	got := repo.Snapshot()[0]
	assert.Equal(t, uid, got.UserID)
	assert.Equal(t, "SUPER_ADMIN", got.Role)
	assert.Equal(t, models.TelemetryAskCopilot, got.Action)
}

func TestTelemetry_LogSync_PropagatesError(t *testing.T) {
	t.Parallel()
	repo := &mockUsageLogRepo{errOnN: 1}
	svc := services.NewTelemetryServiceWithRepo(repo, 4)
	defer svc.Close()

	err := svc.LogSync(context.Background(), uuid.New(), "TENANT", "view_graph")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "simulated")
}

func TestTelemetry_LogAsync_NoBlockAndPersists(t *testing.T) {
	t.Parallel()
	repo := &mockUsageLogRepo{}
	svc := services.NewTelemetryServiceWithRepo(repo, 16)
	defer svc.Close()

	done := make(chan struct{})
	go func() {
		svc.LogAsync(uuid.New(), "SUPER_ADMIN", models.TelemetryAskCopilot)
		close(done)
	}()

	select {
	case <-done:
		// no deadlock / no bloqueo del caller
	case <-time.After(2 * time.Second):
		t.Fatal("LogAsync bloqueó al caller (posible deadlock)")
	}

	require.Eventually(t, func() bool {
		return repo.Count() >= 1
	}, 2*time.Second, 20*time.Millisecond)
}

func TestTelemetry_LogAsync_BufferFull_UsesFallback(t *testing.T) {
	t.Parallel()
	// Buffer=1; bloqueamos el primer Create del worker para saturar el canal.
	block := make(chan struct{})
	repo := &mockUsageLogRepo{blockCh: block}
	svc := services.NewTelemetryServiceWithRepo(repo, 1)
	defer svc.Close()

	// Primer evento ocupa el buffer; worker se queda esperando en Create.
	svc.LogAsync(uuid.New(), "A", "action_1")
	require.Eventually(t, func() bool {
		return repo.calls.Load() >= 1 // worker entró a Create y está bloqueado
	}, 2*time.Second, 10*time.Millisecond)

	// Segundo evento llena el buffer (si worker aún no lo tomó) o va directo.
	svc.LogAsync(uuid.New(), "B", "action_2")
	// Tercer evento: canal lleno → ruta fallback (goroutine).
	svc.LogAsync(uuid.New(), "C", "action_3")

	close(block) // libera worker y fallbacks bloqueados

	require.Eventually(t, func() bool {
		return repo.Count() >= 2
	}, 3*time.Second, 25*time.Millisecond)
}

func TestTelemetry_LogAsync_ConcurrentNoDeadlock(t *testing.T) {
	t.Parallel()
	repo := &mockUsageLogRepo{}
	svc := services.NewTelemetryServiceWithRepo(repo, 32)
	defer svc.Close()

	const N = 200
	var wg sync.WaitGroup
	wg.Add(N)
	start := make(chan struct{})

	for i := 0; i < N; i++ {
		go func(i int) {
			defer wg.Done()
			<-start
			svc.LogAsync(uuid.New(), "TENANT", "ask_copilot")
		}(i)
	}
	close(start)

	finished := make(chan struct{})
	go func() {
		wg.Wait()
		close(finished)
	}()

	select {
	case <-finished:
	case <-time.After(5 * time.Second):
		t.Fatal("deadlock: productores de LogAsync no terminaron")
	}

	require.Eventually(t, func() bool {
		return repo.Count() >= N/2 // al menos la mayoría persistida
	}, 5*time.Second, 50*time.Millisecond)
}

func TestTelemetry_Worker_SurvivesInsertError(t *testing.T) {
	t.Parallel()
	repo := &mockUsageLogRepo{errOnN: 1}
	svc := services.NewTelemetryServiceWithRepo(repo, 8)
	defer svc.Close()

	svc.LogAsync(uuid.New(), "X", "fail_first")
	svc.LogAsync(uuid.New(), "Y", "ok_second")

	require.Eventually(t, func() bool {
		return repo.Count() >= 1 && repo.calls.Load() >= 2
	}, 3*time.Second, 20*time.Millisecond)
}

func TestNewTelemetryServiceWithRepo_MinBuffer(t *testing.T) {
	t.Parallel()
	repo := &mockUsageLogRepo{}
	svc := services.NewTelemetryServiceWithRepo(repo, 0) // fuerza buffer=1
	defer svc.Close()
	svc.LogAsync(uuid.New(), "R", "action")
	require.Eventually(t, func() bool { return repo.Count() == 1 }, 2*time.Second, 20*time.Millisecond)
}
