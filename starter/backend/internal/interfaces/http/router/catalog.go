package router

import (
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/modules"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterCatalogRoutes registra el catálogo DNP. Lecturas: módulo catalog (view).
// Escrituras/importaciones: módulo de plataforma admin.catalogs (solo SUPER_ADMIN
// por lógica de acceso), pues el catálogo es un recurso global.
func RegisterCatalogRoutes(app *fiber.App, db *gorm.DB, jwtSecret string, guard *httpmw.AccessGuard) {
	h := handlers.NewCatalogHandler(db)
	muHandler := handlers.NewMeasurementUnitHandler(db)
	dnpHandler := handlers.NewDnpDictionaryHandler(db)

	catalog := app.Group("/api/v1/catalog",
		httpmw.RequireAuth(jwtSecret),
	)

	catalog.Get("/sectors", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListSectors)
	catalog.Post("/sectors", guard.Require(modules.CodeAdminCatalogs, modules.ActionCreate), h.CreateSector)
	catalog.Post("/sectors/import", guard.Require(modules.CodeAdminCatalogs, modules.ActionCreate), h.ImportSectors)
	catalog.Get("/programs", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListPrograms)
	catalog.Post("/programs", guard.Require(modules.CodeAdminCatalogs, modules.ActionCreate), h.CreateProgram)
	catalog.Post("/programs/import", guard.Require(modules.CodeAdminCatalogs, modules.ActionCreate), h.ImportPrograms)
	catalog.Get("/sectors/:sectorId/programs", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListProgramsBySector)
	catalog.Get("/products", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListCatalogProducts)
	catalog.Post("/products", guard.Require(modules.CodeAdminCatalogs, modules.ActionCreate), h.CreateProduct)
	catalog.Put("/products/:id", guard.Require(modules.CodeAdminCatalogs, modules.ActionEdit), h.UpdateProduct)
	catalog.Delete("/products/:id", guard.Require(modules.CodeAdminCatalogs, modules.ActionDelete), h.DeleteProduct)
	catalog.Post("/products/import", guard.Require(modules.CodeAdminCatalogs, modules.ActionCreate), h.ImportProducts)
	catalog.Get("/products/search", guard.Require(modules.CodeCatalog, modules.ActionView), h.SearchProducts)
	catalog.Get("/edt", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListCatalogEdt)
	catalog.Post("/edt/import", guard.Require(modules.CodeAdminCatalogs, modules.ActionCreate), h.ImportEdt)
	catalog.Get("/deliverables", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListCatalogDeliverables)
	catalog.Post("/deliverables/import", guard.Require(modules.CodeAdminCatalogs, modules.ActionCreate), h.ImportDeliverables)
	catalog.Get("/activities", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListCatalogActivities)
	catalog.Post("/activities/import", guard.Require(modules.CodeAdminCatalogs, modules.ActionCreate), h.ImportActivities)
	catalog.Get("/ods", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListCatalogOds)
	catalog.Post("/ods/import", guard.Require(modules.CodeAdminCatalogs, modules.ActionCreate), h.ImportOds)
	catalog.Get("/pnd", guard.Require(modules.CodeCatalog, modules.ActionView), h.ListCatalogPnd)
	catalog.Post("/pnd/import", guard.Require(modules.CodeAdminCatalogs, modules.ActionCreate), h.ImportPnd)

	// Unidades de medida (tenant / selects)
	catalog.Get("/measurement-units", guard.Require(modules.CodeCatalog, modules.ActionView), muHandler.ListPublic)

	// Diccionarios DNP (verbos y unidades estándar) para formularios de tenant
	catalog.Get("/dnp-dictionary", guard.Require(modules.CodeCatalog, modules.ActionView), dnpHandler.Dictionary)

	// Unidades de medida (admin CRUD)
	adminCatalogs := app.Group("/api/v1/admin/catalogs",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)
	adminCatalogs.Get("/measurement-units", muHandler.ListAdmin)
	adminCatalogs.Post("/measurement-units", muHandler.Create)
	adminCatalogs.Put("/measurement-units/:id", muHandler.Update)
	adminCatalogs.Delete("/measurement-units/:id", muHandler.Delete)

	// Diccionarios DNP (admin CRUD, solo SUPER_ADMIN)
	adminCatalogs.Get("/dnp-verbs", dnpHandler.ListVerbs)
	adminCatalogs.Post("/dnp-verbs", dnpHandler.CreateVerb)
	adminCatalogs.Put("/dnp-verbs/:id", dnpHandler.UpdateVerb)
	adminCatalogs.Delete("/dnp-verbs/:id", dnpHandler.DeleteVerb)
	adminCatalogs.Get("/dnp-units", dnpHandler.ListUnits)
	adminCatalogs.Post("/dnp-units", dnpHandler.CreateUnit)
	adminCatalogs.Put("/dnp-units/:id", dnpHandler.UpdateUnit)
	adminCatalogs.Delete("/dnp-units/:id", dnpHandler.DeleteUnit)
}
