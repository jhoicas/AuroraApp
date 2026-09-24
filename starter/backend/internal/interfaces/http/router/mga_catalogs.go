package router

import (
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterMgaCatalogRoutes registra las rutas de catálogos relacionales MGA.
//
// Rutas públicas (tenant autenticado, cualquier rol):
//   GET /api/v1/mga/catalogs/actors
//   GET /api/v1/mga/catalogs/actors/:id/entities
//   GET /api/v1/mga/catalogs/positions
//
// Rutas de administración (SUPER_ADMIN):
//   CRUD completo en /api/v1/admin/mga/catalogs/{actors,entities,positions}
func RegisterMgaCatalogRoutes(app *fiber.App, db *gorm.DB, jwtSecret string) {
	h := handlers.NewParticipantCatalogHandler(db)

	// ── Rutas públicas (tenant autenticado) ──
	public := app.Group("/api/v1/mga/catalogs",
		httpmw.RequireAuth(jwtSecret),
	)
	public.Get("/actors", h.ListActors)
	public.Get("/actors/:id/entities", h.ListEntitiesByActor)
	public.Get("/positions", h.ListPositions)

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
