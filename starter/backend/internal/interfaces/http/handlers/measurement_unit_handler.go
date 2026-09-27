package handlers

import (
	"strconv"
	"strings"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type MeasurementUnitHandler struct {
	repo *postgres.MeasurementUnitRepository
}

func NewMeasurementUnitHandler(db *gorm.DB) *MeasurementUnitHandler {
	return &MeasurementUnitHandler{
		repo: postgres.NewMeasurementUnitRepository(db),
	}
}

// ListPublic lista todas las unidades de medida para uso en selects de formularios (tenant).
// GET /api/v1/catalog/measurement-units
func (h *MeasurementUnitHandler) ListPublic(c *fiber.Ctx) error {
	units, err := h.repo.ListAll(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list measurement units",
		})
	}
	return c.JSON(units)
}

// ListAdmin lista las unidades de medida con paginación y búsqueda para el panel de administración.
// GET /api/v1/admin/catalogs/measurement-units
func (h *MeasurementUnitHandler) ListAdmin(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	search := strings.TrimSpace(c.Query("search"))
	if search == "" {
		search = strings.TrimSpace(c.Query("q"))
	}

	result, err := h.repo.ListPaginated(c.Context(), postgres.MeasurementUnitListParams{
		Search: search,
		Page:   page,
		Limit:  limit,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list measurement units",
		})
	}

	return c.JSON(dto.PaginatedMeasurementUnitsResponse{
		Data: result.Items,
		Meta: dto.PaginationMeta{
			Total:    result.Total,
			Page:     result.Page,
			Limit:    result.Limit,
			LastPage: result.LastPage,
		},
	})
}

// Create crea una nueva unidad de medida.
// POST /api/v1/admin/catalogs/measurement-units
func (h *MeasurementUnitHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateMeasurementUnitRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Name = strings.TrimSpace(req.Name)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	unit := models.MeasurementUnit{
		ID:   req.ID,
		Name: req.Name,
	}

	if err := h.repo.Create(c.Context(), &unit); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create measurement unit",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(unit)
}

// Update actualiza una unidad de medida.
// PUT /api/v1/admin/catalogs/measurement-units/:id
func (h *MeasurementUnitHandler) Update(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid measurement unit id"})
	}

	var req dto.UpdateMeasurementUnitRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Name = strings.TrimSpace(req.Name)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	unit := models.MeasurementUnit{
		ID:   id,
		Name: req.Name,
	}

	if err := h.repo.Update(c.Context(), &unit); err != nil {
		if postgres.IsMeasurementUnitNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "measurement unit not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update measurement unit",
		})
	}

	return c.JSON(unit)
}

// Delete elimina una unidad de medida.
// DELETE /api/v1/admin/catalogs/measurement-units/:id
func (h *MeasurementUnitHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid measurement unit id"})
	}

	if err := h.repo.Delete(c.Context(), id); err != nil {
		if postgres.IsMeasurementUnitNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "measurement unit not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to delete measurement unit",
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
