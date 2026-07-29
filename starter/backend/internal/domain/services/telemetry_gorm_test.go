package services_test

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestNewTelemetryService_SQLiteIntegration(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:telemetry_test?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	// Esquema SQLite compatible (el default PG gen_random_uuid no aplica aquí).
	require.NoError(t, db.Exec(`
		CREATE TABLE IF NOT EXISTS ai_usage_logs (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			role TEXT NOT NULL,
			action TEXT NOT NULL,
			created_at DATETIME NOT NULL
		)
	`).Error)

	svc := services.NewTelemetryService(db)
	defer svc.Close()

	uid := uuid.New()
	require.NoError(t, svc.LogSync(context.Background(), uid, "SUPER_ADMIN", models.TelemetryAskCopilot))

	svc.LogAsync(uuid.New(), "TENANT", "view_graph")
	require.Eventually(t, func() bool {
		var n int64
		_ = db.Model(&models.AiUsageLog{}).Count(&n).Error
		return n >= 2
	}, 3*time.Second, 25*time.Millisecond)
}

func TestTelemetry_LogAsync_FallbackCreateError(t *testing.T) {
	t.Parallel()
	block := make(chan struct{})
	repo := &failAfterBlockedRepo{block: block}
	svc := services.NewTelemetryServiceWithRepo(repo, 1)
	defer svc.Close()

	svc.LogAsync(uuid.New(), "A", "fill")
	require.Eventually(t, func() bool { return repo.workerEntered.Load() }, 2*time.Second, 10*time.Millisecond)

	svc.LogAsync(uuid.New(), "B", "buffer")
	svc.LogAsync(uuid.New(), "C", "fallback_err")

	close(block)
	time.Sleep(150 * time.Millisecond)
}

type failAfterBlockedRepo struct {
	block         chan struct{}
	workerEntered atomic.Bool
	calls         atomic.Int32
}

func (r *failAfterBlockedRepo) Create(ctx context.Context, entry *models.AiUsageLog) error {
	n := r.calls.Add(1)
	if n == 1 {
		r.workerEntered.Store(true)
		select {
		case <-r.block:
		case <-ctx.Done():
			return ctx.Err()
		}
		return nil
	}
	return errors.New("fallback db down")
}
