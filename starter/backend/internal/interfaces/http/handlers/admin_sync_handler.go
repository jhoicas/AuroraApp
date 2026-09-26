package handlers

import (
	"aurora-backend/internal/application/admin"
	"aurora-backend/internal/infrastructure/soda"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// AdminSyncHandler maneja las solicitudes administrativas para sincronización de catálogos con SODA.
type AdminSyncHandler struct {
	pndSyncService *admin.PndSyncService
}

// NewAdminSyncHandler crea una nueva instancia de AdminSyncHandler.
func NewAdminSyncHandler(db *gorm.DB) *AdminSyncHandler {
	sodaClient := soda.NewClient(soda.DefaultBaseURL, "", nil)
	return &AdminSyncHandler{
		pndSyncService: admin.NewPndSyncService(db, sodaClient),
	}
}

// NewAdminSyncHandlerWithService permite inyectar un servicio personalizado (útil para tests).
func NewAdminSyncHandlerWithService(pndSyncService *admin.PndSyncService) *AdminSyncHandler {
	return &AdminSyncHandler{
		pndSyncService: pndSyncService,
	}
}

// GetSyncStatus consulta y devuelve el último CatalogSyncLog para el catálogo solicitado (ej. ?catalog=PND).
// GET /api/v1/admin/sync/status
func (h *AdminSyncHandler) GetSyncStatus(c *fiber.Ctx) error {
	catalog := c.Query("catalog", "PND")

	logEntry, err := h.pndSyncService.GetLatestSyncStatus(c.Context(), catalog)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to retrieve catalog sync status",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"data": logEntry,
	})
}

// TriggerSync dispara la sincronización del Plan Nacional de Desarrollo (PND) desde SODA.
// POST /api/v1/admin/sync/pnd
func (h *AdminSyncHandler) TriggerSync(c *fiber.Ctx) error {
	result, err := h.pndSyncService.SyncPnd(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to execute PND catalog sync",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "PND catalog sync completed successfully",
		"data":    result,
	})
}
