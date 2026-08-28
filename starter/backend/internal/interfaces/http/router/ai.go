package router

import (
	"aurora-backend/internal/config"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/services"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterAIRoutes(app *fiber.App, db *gorm.DB, cfg *config.Config) {
	telemetry := services.NewTelemetryService(db)
	h := handlers.NewAIHandler(db, telemetry)
	kh := handlers.NewAIKnowledgeHandler(db, cfg, telemetry)
	th := handlers.NewAITelemetryHandler(telemetry)
	aurora := handlers.NewAuroraChatHandler(db, cfg, telemetry)

	ai := app.Group("/api/v1/ai",
		httpmw.RequireAuth(cfg.JWTSecret),
		httpmw.RequireTenant(),
	)

	ai.Post("/chat", httpmw.RateLimitPerUser(10), h.Chat)
	ai.Get("/projects/:projectId/history", h.History)

	// Aurora Copilot — autenticado (SUPER_ADMIN sin tenant)
	auroraGroup := app.Group("/api/v1/ai/aurora",
		httpmw.RequireAuth(cfg.JWTSecret),
	)
	auroraGroup.Post("/chat", httpmw.RateLimitPerUser(20), aurora.Chat)

	telemetryGroup := app.Group("/api/v1/ai/telemetry",
		httpmw.RequireAuth(cfg.JWTSecret),
	)
	telemetryGroup.Post("/log", th.LogTelemetry)

	// Lectura del Knowledge Graph: Super Admin + roles de entidad (solo lectura).
	knowledgeRead := app.Group("/api/v1/ai/knowledge",
		httpmw.RequireAuth(cfg.JWTSecret),
		httpmw.RequireRole(
			constants.RoleSuperAdmin,
			constants.RoleTenantAdmin,
			constants.RoleFormulador,
			constants.RoleEvaluador,
			constants.RoleAnalista,
			constants.RoleViewer,
		),
	)
	knowledgeRead.Get("/graph", kh.GetKnowledgeGraph)

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
