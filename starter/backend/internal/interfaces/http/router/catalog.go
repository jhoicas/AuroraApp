package router

import (
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterCatalogRoutes(app *fiber.App, db *gorm.DB, jwtSecret string) {
	h := handlers.NewCatalogHandler(db)

	catalog := app.Group("/api/v1/catalog",
		httpmw.RequireAuth(jwtSecret),
	)

	catalog.Get("/sectors", h.ListSectors)
	catalog.Post("/sectors", h.CreateSector)
	catalog.Post("/sectors/import", h.ImportSectors)
	catalog.Get("/programs", h.ListPrograms)
	catalog.Post("/programs", h.CreateProgram)
	catalog.Post("/programs/import", h.ImportPrograms)
	catalog.Get("/sectors/:sectorId/programs", h.ListProgramsBySector)
	catalog.Get("/products", h.ListCatalogProducts)
	catalog.Post("/products", h.CreateProduct)
	catalog.Put("/products/:id", h.UpdateProduct)
	catalog.Delete("/products/:id", h.DeleteProduct)
	catalog.Post("/products/import", h.ImportProducts)
	catalog.Get("/products/search", h.SearchProducts)
}
