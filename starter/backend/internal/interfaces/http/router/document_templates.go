package router

import (
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/modules"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterDocumentTemplateRoutes registra /api/v1/tenant/document-templates (solo TENANT_ADMIN).
// Cadena: RequireAuth → RequireTenant → RequireRole(TENANT_ADMIN) → PBAC del módulo projects.
func RegisterDocumentTemplateRoutes(app *fiber.App, db *gorm.DB, jwtSecret string, guard *httpmw.AccessGuard) {
	h := handlers.NewDocumentTemplateHandler(db)
	g := app.Group("/api/v1/tenant/document-templates",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireTenant(),
		httpmw.RequireRole(constants.RoleTenantAdmin),
	)
	g.Get("/", guard.Require(modules.CodeProjects, modules.ActionView), h.List)
	g.Post("/", guard.Require(modules.CodeProjects, modules.ActionEdit), h.Create)
	g.Get("/:id", guard.Require(modules.CodeProjects, modules.ActionView), h.Get)
	g.Put("/:id", guard.Require(modules.CodeProjects, modules.ActionEdit), h.Update)
	g.Patch("/:id", guard.Require(modules.CodeProjects, modules.ActionEdit), h.Update)
	g.Delete("/:id", guard.Require(modules.CodeProjects, modules.ActionEdit), h.Delete)
	g.Patch("/:id/activate", guard.Require(modules.CodeProjects, modules.ActionEdit), h.Activate)
}
