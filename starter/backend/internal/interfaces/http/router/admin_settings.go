package router

import (
	"aurora-backend/internal/application/aisettings"
	"aurora-backend/internal/application/systemsettings"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
)

// RegisterSystemSettingsRoutes registra:
//
//	GET/PUT /api/v1/admin/settings      (SUPER_ADMIN)
//	GET/PUT /api/v1/admin/settings/ai   (SUPER_ADMIN — claves Gemini/Anthropic)
//	GET     /api/v1/system/status       (público: banner + mantenimiento)
func RegisterSystemSettingsRoutes(
	app *fiber.App,
	svc *systemsettings.Service,
	aiSvc *aisettings.Service,
	jwtSecret string,
) {
	h := handlers.NewSystemSettingsHandler(svc)
	aiH := handlers.NewAISettingsHandler(aiSvc)
	app.Get("/api/v1/system/status", h.PublicStatus)

	admin := app.Group("/api/v1/admin/settings",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)
	admin.Get("/", h.Get)
	admin.Put("/", h.Update)
	admin.Get("/ai", aiH.Get)
	admin.Put("/ai", aiH.Update)
}
