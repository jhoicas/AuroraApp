package handlers

import (
	"strconv"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// AdminProcesoHandler gestiona los procesos MGA (verbos rectores DNP).
type AdminProcesoHandler struct {
	db *gorm.DB
}

// NewAdminProcesoHandler constructor.
func NewAdminProcesoHandler(db *gorm.DB) *AdminProcesoHandler {
	return &AdminProcesoHandler{db: db}
}

// ImportProcesos carga masiva de verbos rectores MGA.
// POST /api/v1/admin/procesos/import
func (h *AdminProcesoHandler) ImportProcesos(c *fiber.Ctx) error {
	var req dto.ProcesoImportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid JSON body",
		})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	now := time.Now().UTC()
	resp := dto.ProcesoImportResponse{
		Status:  "success",
		Message: "Procesos importados correctamente",
	}

	err := h.db.WithContext(c.Context()).Transaction(func(tx *gorm.DB) error {
		for _, p := range req.Procesos {
			proceso := models.Proceso{
				ID:        p.ID,
				Name:      p.Name,
				IsActive:  true,
				CreatedAt: now,
				UpdatedAt: now,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "name"}},
				DoUpdates: clause.AssignmentColumns([]string{"updated_at"}),
			}).Create(&proceso).Error; err != nil {
				return err
			}
			resp.ProcesosUpserted++
		}
		return nil
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to import procesos",
			"details": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// ListProcesos devuelve todos los verbos rectores MGA ordenados alfabéticamente.
// Soporta paginación opcional y búsqueda (opcionalmente).
// GET /api/v1/admin/procesos
// Para el endpoint público, filtra IsActive = true. Para admin, devuelve todos.
func (h *AdminProcesoHandler) ListProcesos(c *fiber.Ctx) error {
	var procesos []models.Proceso
	var totalRecords int64

	query := h.db.WithContext(c.Context()).Model(&models.Proceso{})

	// Filtro isActive
	if isActiveParam := c.Query("isActive"); isActiveParam != "" {
		if isActive, err := strconv.ParseBool(isActiveParam); err == nil {
			query = query.Where("is_active = ?", isActive)
		}
	}

	// Búsqueda por nombre
	if search := c.Query("search"); search != "" {
		query = query.Where("name ILIKE ?", "%"+search+"%")
	}

	// Contar total antes de paginar
	if err := query.Count(&totalRecords).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to count procesos",
		})
	}

	// Paginación
	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	if limit < 1 || limit > 1000 {
		limit = 10
	}
	offset := (page - 1) * limit

	err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&procesos).Error

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to list procesos",
			"details": err.Error(),
		})
	}

	totalPages := int((totalRecords + int64(limit) - 1) / int64(limit))
	if totalPages == 0 {
		totalPages = 1
	}

	meta := dto.PaginationMeta{
		Page:     page,
		LastPage: totalPages,
		Total:    totalRecords,
		Limit:    limit,
	}

	return c.JSON(fiber.Map{
		"data": procesos,
		"meta": meta,
	})
}

// CreateProceso crea un único proceso.
// POST /api/v1/admin/procesos
func (h *AdminProcesoHandler) CreateProceso(c *fiber.Ctx) error {
	var req struct {
		ID   int    `json:"id" validate:"required"`
		Name string `json:"name" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	now := time.Now().UTC()
	proceso := models.Proceso{
		ID:        req.ID,
		Name:      req.Name,
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := h.db.WithContext(c.Context()).Create(&proceso).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to create proceso",
			"details": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(proceso)
}

// UpdateProceso actualiza nombre de un proceso.
// PUT /api/v1/admin/procesos/:id
func (h *AdminProcesoHandler) UpdateProceso(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}

	var req struct {
		Name string `json:"name" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	res := h.db.WithContext(c.Context()).Model(&models.Proceso{}).Where("id = ?", id).Updates(map[string]interface{}{
		"name": req.Name,
	})
	if res.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": res.Error.Error()})
	}
	if res.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}

	return c.JSON(fiber.Map{"status": "updated"})
}

// ToggleStatusProceso cambia el estado is_active.
// PUT /api/v1/admin/procesos/:id/toggle
func (h *AdminProcesoHandler) ToggleStatusProceso(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid id"})
	}

	var p models.Proceso
	if err := h.db.WithContext(c.Context()).First(&p, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}

	p.IsActive = !p.IsActive
	if err := h.db.WithContext(c.Context()).Save(&p).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"status": "updated", "is_active": p.IsActive})
}
