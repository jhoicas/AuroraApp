package handlers

import (
	"strings"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BudgetHandler struct {
	db *gorm.DB
}

func NewBudgetHandler(db *gorm.DB) *BudgetHandler {
	return &BudgetHandler{db: db}
}

func (h *BudgetHandler) Create(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	if _, err := loadOwnedProject(h.db, c.Context(), projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify project ownership"})
	}

	var req dto.CreateBudgetItemRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Description = strings.TrimSpace(req.Description)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var productID *uuid.UUID
	if req.ProductID != nil && strings.TrimSpace(*req.ProductID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*req.ProductID))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid product_id"})
		}
		var count int64
		if err := h.db.WithContext(c.Context()).
			Model(&models.Product{}).
			Where("id = ?", parsed).
			Count(&count).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify product"})
		}
		if count == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "product not found in DNP catalog"})
		}
		productID = &parsed
	}

	now := time.Now().UTC()
	item := models.BudgetItem{
		ID:          uuid.New(),
		TenantID:    tenantID,
		ProjectID:   projectID,
		ProductID:   productID,
		Description: req.Description,
		Amount:      req.Amount,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := h.db.WithContext(c.Context()).Create(&item).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create budget item"})
	}

	return c.Status(fiber.StatusCreated).JSON(toBudgetItemResponse(item))
}

func (h *BudgetHandler) List(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	if _, err := loadOwnedProject(h.db, c.Context(), projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify project ownership"})
	}

	items := make([]models.BudgetItem, 0)
	if err := h.db.WithContext(c.Context()).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("created_at ASC").
		Find(&items).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list budget items"})
	}

	data := make([]dto.BudgetItemResponse, 0, len(items))
	for _, item := range items {
		data = append(data, toBudgetItemResponse(item))
	}

	return c.JSON(data)
}

func (h *BudgetHandler) Delete(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	itemID, err := uuid.Parse(c.Params("itemId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid budget item id"})
	}

	if _, err := loadOwnedProject(h.db, c.Context(), projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify project ownership"})
	}

	result := h.db.WithContext(c.Context()).
		Where("id = ? AND project_id = ? AND tenant_id = ?", itemID, projectID, tenantID).
		Delete(&models.BudgetItem{})

	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete budget item"})
	}
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "budget item not found"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func toBudgetItemResponse(item models.BudgetItem) dto.BudgetItemResponse {
	var productID *string
	if item.ProductID != nil {
		s := item.ProductID.String()
		productID = &s
	}
	return dto.BudgetItemResponse{
		ID:          item.ID.String(),
		TenantID:    item.TenantID.String(),
		ProjectID:   item.ProjectID.String(),
		ProductID:   productID,
		Description: item.Description,
		Amount:      item.Amount,
		CreatedAt:   item.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:   item.UpdatedAt.UTC().Format(time.RFC3339),
	}
}
