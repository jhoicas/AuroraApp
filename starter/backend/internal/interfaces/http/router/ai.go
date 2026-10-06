package router

import (
	"aurora-backend/internal/config"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/modules"
	"aurora-backend/internal/domain/services"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterAIRoutes registra el asistente IA. Usar el asistente (chat, sugerencias,
// historial, grafo) se considera "view" del módulo ai; la telemetría del cliente no se controla.
func RegisterAIRoutes(app *fiber.App, db *gorm.DB, cfg *config.Config, guard *httpmw.AccessGuard) {
	telemetry := services.NewTelemetryService(db)
	h := handlers.NewAIHandler(db, telemetry, cfg)
	kh := handlers.NewAIKnowledgeHandler(db, cfg, telemetry)
	th := handlers.NewAITelemetryHandler(telemetry)
	aurora := handlers.NewAuroraChatHandler(db, cfg, telemetry)
	ideation := handlers.NewIdeationHandler(db, cfg, telemetry)

	ai := app.Group("/api/v1/ai",
		httpmw.RequireAuth(cfg.JWTSecret),
		httpmw.RequireTenant(),
	)

	ai.Post("/chat", guard.Require(modules.CodeAI, modules.ActionView), httpmw.RateLimitPerUser(10), h.Chat)
	ai.Get("/projects/:projectId/history", guard.Require(modules.CodeAI, modules.ActionView), h.History)
	ai.Post("/mga/suggest-field", guard.Require(modules.CodeAI, modules.ActionView), httpmw.RateLimitPerUser(20), h.SuggestField)

	ideationGroup := app.Group("/api/v1/ai/ideation",
		httpmw.RequireAuth(cfg.JWTSecret),
		httpmw.RequireTenant(),
	)
	ideationGroup.Post("/chat", guard.Require(modules.CodeAI, modules.ActionView), httpmw.RateLimitPerUser(20), ideation.Chat)
	ideationGroup.Post("/suggest", guard.Require(modules.CodeAI, modules.ActionView), httpmw.RateLimitPerUser(10), ideation.SuggestProjectSetup)

	// Aurora Copilot — autenticado (SUPER_ADMIN sin tenant)
	auroraGroup := app.Group("/api/v1/ai/aurora",
		httpmw.RequireAuth(cfg.JWTSecret),
	)
	auroraGroup.Post("/chat", guard.Require(modules.CodeAI, modules.ActionView), httpmw.RateLimitPerUser(20), aurora.Chat)

	telemetryGroup := app.Group("/api/v1/ai/telemetry",
		httpmw.RequireAuth(cfg.JWTSecret),
	)
	telemetryGroup.Post("/log", th.LogTelemetry)

	// Lectura del Knowledge Graph: autenticado; el acceso lo decide PBAC (módulo ai).
	knowledgeRead := app.Group("/api/v1/ai/knowledge",
		httpmw.RequireAuth(cfg.JWTSecret),
	)
	knowledgeRead.Get("/graph", guard.Require(modules.CodeAI, modules.ActionView), kh.GetKnowledgeGraph)

	// Ingesta del Cerebro: exclusivo SUPER_ADMIN (recurso global).
	knowledgeWrite := app.Group("/api/v1/ai/knowledge",
		httpmw.RequireAuth(cfg.JWTSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)
	knowledgeWrite.Post("/ingest", kh.IngestKnowledge)

	audit := app.Group("/api/v1/ai/audit",
		httpmw.RequireAuth(cfg.JWTSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)
	ah := handlers.NewAIAuditHandler(db)
	audit.Get("/usage", ah.ListUsageLogs)
	audit.Get("/chat", ah.ListChatMessages)
}
