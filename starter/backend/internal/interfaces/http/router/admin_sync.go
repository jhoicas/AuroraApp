package router

import (
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/interfaces/http/handlers"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterAdminSyncRoutes registra las rutas administrativas para sincronización de catálogos con datos abiertos.
func RegisterAdminSyncRoutes(app *fiber.App, db *gorm.DB, jwtSecret string) {
	h := handlers.NewAdminSyncHandler(db)

	adminSync := app.Group("/api/v1/admin/sync",
		httpmw.RequireAuth(jwtSecret),
		httpmw.RequireRole(constants.RoleSuperAdmin),
	)

	adminSync.Get("/status", h.GetSyncStatus)
	adminSync.Post("/pnd", h.TriggerSync)
	adminSync.Post("/sectors", h.TriggerSectorsSync)
	adminSync.Post("/programs", h.TriggerProgramsSync)
	adminSync.Post("/products", h.TriggerProductsSync)
	adminSync.Post("/edt", h.TriggerEdtSync)
	adminSync.Post("/divipola", h.TriggerDivipolaSync)
}
