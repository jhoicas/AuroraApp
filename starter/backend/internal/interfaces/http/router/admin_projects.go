package router

import (
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterAdminProjectRoutes registra la vista global de proyectos (SUPER_ADMIN):
//
//	GET /api/v1/admin/projects
func RegisterAdminProjectRoutes(app *fiber.App, db *gorm.DB, jwtSecret string) {
	h := handlers.NewAdminProjectHandler(db)
	admin := app.Group("/api/v1/admin",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)
	admin.Get("/projects", h.List)
}
