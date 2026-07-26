package router

import (
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterAdminTenantRoutes(app *fiber.App, db *gorm.DB, jwtSecret string) {
	h := handlers.NewTenantHandler(db)

	admin := app.Group("/api/v1/admin",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)

	tenants := admin.Group("/tenants")
	tenants.Post("/", h.Create)
	tenants.Get("/", h.List)
	tenants.Patch("/:id/status", h.UpdateStatus)
}
