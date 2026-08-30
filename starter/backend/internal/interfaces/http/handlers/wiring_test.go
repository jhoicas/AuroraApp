package handlers

import (
	"context"
	"net/http"
	"testing"
	"time"

	"aurora-backend/internal/config"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"
	"aurora-backend/internal/infrastructure/persistence/postgres"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newSQLiteDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:handlers_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	return db
}

func testConfig() *config.Config {
	return &config.Config{
		JWTSecret:              "test-secret",
		AnthropicApiKey:        "sk-test",
		AnthropicModel:         "claude-haiku-4-5-20251001",
		AnthropicModelFast:     "claude-haiku-4-5-20251001",
		AnthropicModelPowerful: "claude-sonnet-4-20250514",
		EmbeddingProvider:      "mock",
		EmbeddingModel:         "all-MiniLM-L6-v2",
	}
}

// captureUsageRepo registra la telemetría emitida por los handlers.
type captureUsageRepo struct {
	entries chan models.AiUsageLog
}

func newCaptureUsageRepo() *captureUsageRepo {
	return &captureUsageRepo{entries: make(chan models.AiUsageLog, 32)}
}

func (r *captureUsageRepo) Create(_ context.Context, entry *models.AiUsageLog) error {
	select {
	case r.entries <- *entry:
	default:
	}
	return nil
}

func (r *captureUsageRepo) waitFor(t *testing.T, action string) {
	t.Helper()
	deadline := time.After(3 * time.Second)
	for {
		select {
		case e := <-r.entries:
			if e.Action == action {
				return
			}
		case <-deadline:
			t.Fatalf("no se recibió telemetría para la acción %q", action)
		}
	}
}

func TestProductionConstructorsWireDependencies(t *testing.T) {
	db := newSQLiteDB(t)
	cfg := testConfig()
	telemetry := services.NewTelemetryServiceWithRepo(newCaptureUsageRepo(), 8)
	defer telemetry.Close()

	assert.NotNil(t, NewAIKnowledgeHandler(db, cfg, telemetry))
	assert.NotNil(t, NewAuroraChatHandler(db, cfg, telemetry))
	assert.NotNil(t, NewAIAuditHandler(db))
	assert.NotNil(t, NewProjectEvaluationHandler(db))
	assert.NotNil(t, NewAITelemetryHandler(telemetry))
}

func TestAuroraChat_EmitsTelemetry(t *testing.T) {
	repo := newCaptureUsageRepo()
	telemetry := services.NewTelemetryServiceWithRepo(repo, 8)
	defer telemetry.Close()

	h := NewAuroraChatHandlerWithDeps(&mockKnowledgeStore{}, &mockChatStore{}, &mockEmbedder{}, &mockLLM{reply: "ok"}, telemetry, testChatCfg())
	app := newTestApp()
	app.Post("/chat", injectIdentity(validIdentity()), h.Chat)

	resp := doJSON(t, app, http.MethodPost, "/chat", map[string]any{"message": "hola"})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	repo.waitFor(t, models.TelemetryAskCopilot)
}

func TestIngestKnowledge_EmitsTelemetry(t *testing.T) {
	repo := newCaptureUsageRepo()
	telemetry := services.NewTelemetryServiceWithRepo(repo, 8)
	defer telemetry.Close()

	h := NewAIKnowledgeHandlerWithDeps(&mockKnowledgeStore{}, &mockEmbedder{}, telemetry)
	app := newTestApp()
	app.Post("/ingest", injectIdentity(validIdentity()), h.IngestKnowledge)

	resp := uploadXML(t, app, "file", "acueducto.xml", validMGAXML)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	repo.waitFor(t, models.TelemetryIngestXML)
}

func TestIngestKnowledge_InvalidUserSkipsTelemetry(t *testing.T) {
	repo := newCaptureUsageRepo()
	telemetry := services.NewTelemetryServiceWithRepo(repo, 8)
	defer telemetry.Close()

	h := NewAIKnowledgeHandlerWithDeps(&mockKnowledgeStore{}, &mockEmbedder{}, telemetry)
	app := newTestApp()
	app.Post("/ingest", injectIdentity(identity{userID: "no-uuid", role: "TENANT"}), h.IngestKnowledge)

	resp := uploadXML(t, app, "file", "acueducto.xml", validMGAXML)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	select {
	case e := <-repo.entries:
		t.Fatalf("no debería emitirse telemetría con un user_id inválido: %+v", e)
	case <-time.After(200 * time.Millisecond):
	}
}

func TestTelemetryHandler_EmitsLog(t *testing.T) {
	repo := newCaptureUsageRepo()
	telemetry := services.NewTelemetryServiceWithRepo(repo, 8)
	defer telemetry.Close()

	h := NewAITelemetryHandler(telemetry)
	app := newTestApp()
	app.Post("/log", injectIdentity(validIdentity()), h.LogTelemetry)

	resp := doJSON(t, app, http.MethodPost, "/log", map[string]any{"action": "apply_action_card"})
	require.Equal(t, http.StatusOK, resp.StatusCode)
	repo.waitFor(t, "apply_action_card")
}

func TestLoadOwnedProject_TenantIsolation(t *testing.T) {
	db := newSQLiteDB(t)
	require.NoError(t, db.Exec(`
		CREATE TABLE projects (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			creator_id TEXT NOT NULL,
			code_bpin TEXT,
			name TEXT NOT NULL,
			description TEXT,
			sector TEXT,
			problem_description TEXT,
			general_objective TEXT,
			status TEXT NOT NULL DEFAULT 'DRAFT',
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)
	`).Error)

	tenantA, tenantB := uuid.New(), uuid.New()
	projectID := uuid.New()
	now := time.Now().UTC()

	require.NoError(t, db.Exec(
		`INSERT INTO projects (id, tenant_id, creator_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		projectID, tenantA, uuid.New(), "Acueducto", "DRAFT", now, now,
	).Error)

	t.Run("tenant propietario encuentra el proyecto", func(t *testing.T) {
		project, err := loadOwnedProject(db, context.Background(), projectID, tenantA)
		require.NoError(t, err)
		assert.Equal(t, "Acueducto", project.Name)
	})

	t.Run("otro tenant no puede verlo", func(t *testing.T) {
		_, err := loadOwnedProject(db, context.Background(), projectID, tenantB)
		require.Error(t, err)
		assert.True(t, isNotFound(err))
	})

	t.Run("ProjectRepository aplica el mismo aislamiento", func(t *testing.T) {
		var finder ProjectFinder = postgres.NewProjectRepository(db)

		project, err := finder.FindOwned(context.Background(), projectID, tenantA)
		require.NoError(t, err)
		assert.Equal(t, projectID, project.ID)

		_, err = finder.FindOwned(context.Background(), projectID, tenantB)
		require.Error(t, err)
		assert.True(t, isNotFound(err))
	})
}

func TestIsNotFound(t *testing.T) {
	assert.True(t, isNotFound(gorm.ErrRecordNotFound))
	assert.False(t, isNotFound(errSimulatedDB))
	assert.False(t, isNotFound(nil))
}
