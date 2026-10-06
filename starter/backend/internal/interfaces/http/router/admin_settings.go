package router

import (
	"aurora-backend/internal/application/systemsettings"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
)

// RegisterSystemSettingsRoutes registra:
//
//	GET/PUT /api/v1/admin/settings   (SUPER_ADMIN)
//	GET     /api/v1/system/status    (público: banner + mantenimiento)
func RegisterSystemSettingsRoutes(app *fiber.App, svc *systemsettings.Service, jwtSecret string) {
	h := handlers.NewSystemSettingsHandler(svc)
	app.Get("/api/v1/system/status", h.PublicStatus)

	admin := app.Group("/api/v1/admin/settings",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)
	admin.Get("/", h.Get)
	admin.Put("/", h.Update)
}
