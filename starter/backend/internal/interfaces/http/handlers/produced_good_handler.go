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

type ProducedGoodHandler struct {
	repo *postgres.ProducedGoodRepository
}

func NewProducedGoodHandler(db *gorm.DB) *ProducedGoodHandler {
	return &ProducedGoodHandler{repo: postgres.NewProducedGoodRepository(db)}
}

// ListPublic lista todos los bienes producidos para selects de formularios (tenant).
// GET /api/v1/catalog/produced-goods
func (h *ProducedGoodHandler) ListPublic(c *fiber.Ctx) error {
	goods, err := h.repo.ListAll(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list produced goods"})
	}
	return c.JSON(goods)
}

// ListAdmin lista los bienes producidos con paginación y búsqueda.
// GET /api/v1/admin/catalogs/produced-goods
func (h *ProducedGoodHandler) ListAdmin(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	search := strings.TrimSpace(c.Query("search"))
	if search == "" {
		search = strings.TrimSpace(c.Query("q"))
	}

	result, err := h.repo.ListPaginated(c.Context(), postgres.ProducedGoodListParams{Search: search, Page: page, Limit: limit})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list produced goods"})
	}

	return c.JSON(dto.PaginatedProducedGoodsResponse{
		Data: result.Items,
		Meta: dto.PaginationMeta{Total: result.Total, Page: result.Page, Limit: result.Limit, LastPage: result.LastPage},
	})
}

func parseProducedGoodRequest(c *fiber.Ctx) (*dto.ProducedGoodRequest, error) {
	var req dto.ProducedGoodRequest
	if err := c.BodyParser(&req); err != nil {
		return nil, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Description = strings.TrimSpace(req.Description)
	if err := dto.Validate(&req); err != nil {
		return nil, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	return &req, nil
}

// Create POST /api/v1/admin/catalogs/produced-goods
func (h *ProducedGoodHandler) Create(c *fiber.Ctx) error {
	req, err := parseProducedGoodRequest(c)
	if req == nil {
		return err
	}
	good := models.ProducedGood{Description: req.Description, Rpc: req.Rpc}
	if err := h.repo.Create(c.Context(), &good); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create produced good"})
	}
	return c.Status(fiber.StatusCreated).JSON(good)
}

// Update PUT /api/v1/admin/catalogs/produced-goods/:id
func (h *ProducedGoodHandler) Update(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid produced good id"})
	}
	req, perr := parseProducedGoodRequest(c)
	if req == nil {
		return perr
	}
	good := models.ProducedGood{ID: uint(id), Description: req.Description, Rpc: req.Rpc}
	if err := h.repo.Update(c.Context(), &good); err != nil {
		if postgres.IsProducedGoodNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "produced good not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update produced good"})
	}
	return c.JSON(good)
}

// Delete DELETE /api/v1/admin/catalogs/produced-goods/:id
func (h *ProducedGoodHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid produced good id"})
	}
	if err := h.repo.Delete(c.Context(), uint(id)); err != nil {
		if postgres.IsProducedGoodNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "produced good not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete produced good"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
