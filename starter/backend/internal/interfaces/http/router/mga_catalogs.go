package router

import (
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/modules"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterMgaCatalogRoutes registra las rutas de catálogos relacionales MGA.
//
// Rutas públicas (tenant autenticado, cualquier rol):
//
//	GET /api/v1/mga/catalogs/actors
//	GET /api/v1/mga/catalogs/actors/:id/entities
//	GET /api/v1/mga/catalogs/positions
//
// Rutas de administración (SUPER_ADMIN):
//
//	CRUD completo en /api/v1/admin/mga/catalogs/{actors,entities,positions}
func RegisterMgaCatalogRoutes(app *fiber.App, db *gorm.DB, jwtSecret string, guard *httpmw.AccessGuard) {
	h := handlers.NewParticipantCatalogHandler(db)

	// ── Rutas públicas (tenant autenticado) ──
	public := app.Group("/api/v1/mga/catalogs",
		httpmw.RequireAuth(jwtSecret),
	)
	public.Get("/actors", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListActors)
	public.Get("/actors/:id/entities", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListEntitiesByActor)
	public.Get("/positions", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListPositions)

	locHandler := handlers.NewLocationHandler(db)
	public.Get("/regions", guard.Require(modules.CodeCatalog, modules.ActionView), locHandler.ListRegions)
	public.Get("/departments", guard.Require(modules.CodeCatalog, modules.ActionView), locHandler.ListDepartments)
	public.Get("/municipalities", guard.Require(modules.CodeCatalog, modules.ActionView), locHandler.ListMunicipalities)
	public.Get("/groupings", guard.Require(modules.CodeCatalog, modules.ActionView), locHandler.ListGroupings)

	// ── Rutas de administración (SUPER_ADMIN) ──
	admin := app.Group("/api/v1/admin/mga/catalogs",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)

	// Actores
	admin.Get("/actors", h.ListActors)
	admin.Post("/actors", h.CreateActor)
	admin.Put("/actors/:id", h.UpdateActor)
	admin.Delete("/actors/:id", h.DeleteActor)

	// Entidades
	admin.Get("/entities", h.ListEntities)
	admin.Get("/actors/:id/entities", h.ListEntitiesByActor)
	admin.Post("/entities", h.CreateEntity)
	admin.Put("/entities/:id", h.UpdateEntity)
	admin.Delete("/entities/:id", h.DeleteEntity)

	// Posiciones
	admin.Get("/positions", h.ListPositions)
	admin.Post("/positions", h.CreatePosition)
	admin.Put("/positions/:id", h.UpdatePosition)
	admin.Delete("/positions/:id", h.DeletePosition)
}
