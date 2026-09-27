package handlers

import (
	"strings"

	"aurora-backend/internal/application/admin"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/soda"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// AdminSyncHandler maneja las solicitudes administrativas para sincronización de catálogos con SODA.
type AdminSyncHandler struct {
	pndSyncService    *admin.PndSyncService
	sectorSyncService *admin.SectorSyncService
}

// NewAdminSyncHandler crea una nueva instancia de AdminSyncHandler.
func NewAdminSyncHandler(db *gorm.DB) *AdminSyncHandler {
	sodaClient := soda.NewClient(soda.DefaultBaseURL, "", nil)
	return &AdminSyncHandler{
		pndSyncService:    admin.NewPndSyncService(db, sodaClient),
		sectorSyncService: admin.NewSectorSyncService(db, sodaClient),
	}
}

// NewAdminSyncHandlerWithService permite inyectar servicios personalizados (útil para tests).
func NewAdminSyncHandlerWithService(pndSyncService *admin.PndSyncService, sectorSyncServices ...*admin.SectorSyncService) *AdminSyncHandler {
	var sectorService *admin.SectorSyncService
	if len(sectorSyncServices) > 0 {
		sectorService = sectorSyncServices[0]
	}
	return &AdminSyncHandler{
		pndSyncService:    pndSyncService,
		sectorSyncService: sectorService,
	}
}

// GetSyncStatus consulta y devuelve el último CatalogSyncLog para el catálogo solicitado (ej. ?catalog=PND o ?catalog=SECTORS).
// GET /api/v1/admin/sync/status
func (h *AdminSyncHandler) GetSyncStatus(c *fiber.Ctx) error {
	catalog := c.Query("catalog", "PND")

	var logEntry *models.CatalogSyncLog
	var err error

	if strings.EqualFold(strings.TrimSpace(catalog), "SECTORS") && h.sectorSyncService != nil {
		logEntry, err = h.sectorSyncService.GetLatestSyncStatus(c.Context(), catalog)
	} else if h.pndSyncService != nil {
		logEntry, err = h.pndSyncService.GetLatestSyncStatus(c.Context(), catalog)
	} else if h.sectorSyncService != nil {
		logEntry, err = h.sectorSyncService.GetLatestSyncStatus(c.Context(), catalog)
	}

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

// TriggerSectorsSync dispara la sincronización del catálogo de Sectores desde SODA.
// POST /api/v1/admin/sync/sectors
func (h *AdminSyncHandler) TriggerSectorsSync(c *fiber.Ctx) error {
	if h.sectorSyncService == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "sector sync service is not configured",
		})
	}

	result, err := h.sectorSyncService.SyncSectors(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to execute sectors catalog sync",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Sectors catalog sync completed successfully",
		"data":    result,
	})
}
