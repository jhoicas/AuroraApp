package router

import (
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterAdminLocationRoutes registra rutas de localizaciones y procesos.
//
// Lectura (GET /locations, GET /procesos): cualquier usuario autenticado.
// Escritura (POST .../import): solo SUPER_ADMIN.
func RegisterAdminLocationRoutes(app *fiber.App, db *gorm.DB, jwtSecret string) {
	h := handlers.NewAdminLocationHandler(db)

	// ── Rutas de solo lectura (autenticado, sin rol especial) ──
	authenticated := app.Group("/api/v1",
		httpmw.RequireAuth(jwtSecret),
	)
	authenticated.Get("/locations", h.ListLocations)
	authenticated.Get("/procesos", h.ListProcesos)

	// ── Rutas de importación (SUPER_ADMIN) ──
	admin := app.Group("/api/v1/admin",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)
	admin.Post("/locations/import", h.ImportLocations)
	admin.Post("/procesos/import", h.ImportProcesos)
}
