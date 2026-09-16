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
	locHandler := handlers.NewAdminLocationHandler(db)
	procHandler := handlers.NewAdminProcesoHandler(db)

	// ── Rutas de solo lectura (autenticado, sin rol especial) ──
	authenticated := app.Group("/api/v1",
		httpmw.RequireAuth(jwtSecret),
	)
	authenticated.Get("/locations", locHandler.ListLocations)
	authenticated.Get("/procesos", procHandler.ListProcesos)

	// ── Rutas de importación y administración (SUPER_ADMIN) ──
	admin := app.Group("/api/v1/admin",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)
	
	// Importaciones masivas
	admin.Post("/locations/import", locHandler.ImportLocations)
	admin.Post("/procesos/import", procHandler.ImportProcesos)
	
	// Listado de localizaciones (Paginado admin)
	admin.Get("/locations", locHandler.ListAdminLocations)
	
	// Procesos CRUD
	admin.Get("/procesos", procHandler.ListProcesos) // Admin list (includes inactive)
	admin.Post("/procesos", procHandler.CreateProceso)
	admin.Put("/procesos/:id", procHandler.UpdateProceso)
	admin.Delete("/procesos/:id", procHandler.ToggleStatusProceso)
	admin.Put("/procesos/:id/toggle", procHandler.ToggleStatusProceso)

	// Regiones CRUD
	admin.Post("/locations/regiones", locHandler.CreateRegion)
	admin.Put("/locations/regiones/:id", locHandler.UpdateRegion)
	admin.Delete("/locations/regiones/:id", locHandler.ToggleRegion)
	admin.Put("/locations/regiones/:id/toggle", locHandler.ToggleRegion)

	// Departamentos CRUD
	admin.Post("/locations/departamentos", locHandler.CreateDepartamento)
	admin.Put("/locations/departamentos/:id", locHandler.UpdateDepartamento)
	admin.Delete("/locations/departamentos/:id", locHandler.ToggleDepartamento)
	admin.Put("/locations/departamentos/:id/toggle", locHandler.ToggleDepartamento)

	// Municipios CRUD
	admin.Post("/locations/municipios", locHandler.CreateMunicipio)
	admin.Put("/locations/municipios/:id", locHandler.UpdateMunicipio)
	admin.Delete("/locations/municipios/:id", locHandler.ToggleMunicipio)
	admin.Put("/locations/municipios/:id/toggle", locHandler.ToggleMunicipio)
}
