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
	pndSyncService     *admin.PndSyncService
	sectorSyncService  *admin.SectorSyncService
	programSyncService *admin.ProgramSyncService
	productSyncService *admin.ProductSyncService
	edtSyncService     *admin.EdtSyncService
}

// NewAdminSyncHandler crea una nueva instancia de AdminSyncHandler.
func NewAdminSyncHandler(db *gorm.DB) *AdminSyncHandler {
	sodaClient := soda.NewClient(soda.DefaultBaseURL, "", nil)
	return &AdminSyncHandler{
		pndSyncService:     admin.NewPndSyncService(db, sodaClient),
		sectorSyncService:  admin.NewSectorSyncService(db, sodaClient),
		programSyncService: admin.NewProgramSyncService(db, sodaClient),
		productSyncService: admin.NewProductSyncService(db, sodaClient),
		edtSyncService:     admin.NewEdtSyncService(db, sodaClient),
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

// WithProgramSyncService inyecta el servicio de sincronización de programas (útil para tests).
func (h *AdminSyncHandler) WithProgramSyncService(svc *admin.ProgramSyncService) *AdminSyncHandler {
	h.programSyncService = svc
	return h
}

// WithProductSyncService inyecta el servicio de sincronización de productos (útil para tests).
func (h *AdminSyncHandler) WithProductSyncService(svc *admin.ProductSyncService) *AdminSyncHandler {
	h.productSyncService = svc
	return h
}

// WithEdtSyncService inyecta el servicio de sincronización de EDT (útil para tests).
func (h *AdminSyncHandler) WithEdtSyncService(svc *admin.EdtSyncService) *AdminSyncHandler {
	h.edtSyncService = svc
	return h
}

// GetSyncStatus consulta y devuelve el último CatalogSyncLog para el catálogo solicitado (ej. ?catalog=PND, ?catalog=SECTORS, ?catalog=PROGRAMS, ?catalog=PRODUCTS o ?catalog=EDT).
// GET /api/v1/admin/sync/status
func (h *AdminSyncHandler) GetSyncStatus(c *fiber.Ctx) error {
	catalog := c.Query("catalog", "PND")

	var logEntry *models.CatalogSyncLog
	var err error

	trimmedCatalog := strings.TrimSpace(catalog)
	if strings.EqualFold(trimmedCatalog, "EDT") && h.edtSyncService != nil {
		logEntry, err = h.edtSyncService.GetLatestSyncStatus(c.Context(), catalog)
	} else if strings.EqualFold(trimmedCatalog, "PRODUCTS") && h.productSyncService != nil {
		logEntry, err = h.productSyncService.GetLatestSyncStatus(c.Context(), catalog)
	} else if strings.EqualFold(trimmedCatalog, "PROGRAMS") && h.programSyncService != nil {
		logEntry, err = h.programSyncService.GetLatestSyncStatus(c.Context(), catalog)
	} else if strings.EqualFold(trimmedCatalog, "SECTORS") && h.sectorSyncService != nil {
		logEntry, err = h.sectorSyncService.GetLatestSyncStatus(c.Context(), catalog)
	} else if h.pndSyncService != nil {
		logEntry, err = h.pndSyncService.GetLatestSyncStatus(c.Context(), catalog)
	} else if h.sectorSyncService != nil {
		logEntry, err = h.sectorSyncService.GetLatestSyncStatus(c.Context(), catalog)
	} else if h.programSyncService != nil {
		logEntry, err = h.programSyncService.GetLatestSyncStatus(c.Context(), catalog)
	} else if h.productSyncService != nil {
		logEntry, err = h.productSyncService.GetLatestSyncStatus(c.Context(), catalog)
	} else if h.edtSyncService != nil {
		logEntry, err = h.edtSyncService.GetLatestSyncStatus(c.Context(), catalog)
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

// TriggerProgramsSync dispara la sincronización del catálogo de Programas desde SODA.
// POST /api/v1/admin/sync/programs
func (h *AdminSyncHandler) TriggerProgramsSync(c *fiber.Ctx) error {
	if h.programSyncService == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "program sync service is not configured",
		})
	}

	result, err := h.programSyncService.SyncPrograms(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to execute programs catalog sync",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Programs catalog sync completed successfully",
		"data":    result,
	})
}

// TriggerProductsSync dispara la sincronización del catálogo de Productos desde SODA.
// POST /api/v1/admin/sync/products
func (h *AdminSyncHandler) TriggerProductsSync(c *fiber.Ctx) error {
	if h.productSyncService == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "product sync service is not configured",
		})
	}

	result, err := h.productSyncService.SyncProducts(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to execute products catalog sync",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Products catalog sync completed successfully",
		"data":    result,
	})
}

// TriggerEdtSync dispara la sincronización del catálogo EDT desde SODA.
// POST /api/v1/admin/sync/edt
func (h *AdminSyncHandler) TriggerEdtSync(c *fiber.Ctx) error {
	if h.edtSyncService == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "edt sync service is not configured",
		})
	}

	result, err := h.edtSyncService.SyncEdt(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to execute EDT catalog sync",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "EDT catalog sync completed successfully",
		"data":    result,
	})
}

