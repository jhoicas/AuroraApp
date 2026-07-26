package handlers

import (
	"errors"
	"math"
	"strconv"
	"strings"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TenantHandler struct {
	db *gorm.DB
}

func NewTenantHandler(db *gorm.DB) *TenantHandler {
	return &TenantHandler{db: db}
}

func (h *TenantHandler) Create(c *fiber.Ctx) error {
	var req dto.CreateTenantRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}

	req.Name = strings.TrimSpace(req.Name)
	req.NIT = strings.TrimSpace(req.NIT)
	req.ContactEmail = strings.TrimSpace(strings.ToLower(req.ContactEmail))
	if req.Domain != nil {
		d := strings.TrimSpace(strings.ToLower(*req.Domain))
		req.Domain = &d
	}

	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	nit := req.NIT
	tenant := models.Tenant{
		ID:           uuid.New(),
		Name:         req.Name,
		NIT:          &nit,
		Domain:       req.Domain,
		ContactEmail: req.ContactEmail,
		Status:       constants.TenantStatusActive,
		IsActive:     true,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}

	if err := h.db.WithContext(c.Context()).Create(&tenant).Error; err != nil {
		if isUniqueViolation(err) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "tenant with same nit or domain already exists",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create tenant"})
	}

	return c.Status(fiber.StatusCreated).JSON(toTenantResponse(tenant))
}

func (h *TenantHandler) List(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int64
	q := h.db.WithContext(c.Context()).Model(&models.Tenant{})
	if err := q.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count tenants"})
	}

	var tenants []models.Tenant
	if err := q.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&tenants).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list tenants"})
	}

	data := make([]dto.TenantResponse, 0, len(tenants))
	for _, t := range tenants {
		data = append(data, toTenantResponse(t))
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))
	if totalPages == 0 {
		totalPages = 1
	}

	return c.JSON(dto.PaginatedTenantsResponse{
		Data:       data,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *TenantHandler) UpdateStatus(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid tenant id"})
	}

	var req dto.UpdateTenantStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Status = strings.TrimSpace(strings.ToUpper(req.Status))
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var tenant models.Tenant
	if err := h.db.WithContext(c.Context()).First(&tenant, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "tenant not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load tenant"})
	}

	tenant.Status = req.Status
	tenant.IsActive = req.Status == constants.TenantStatusActive
	tenant.UpdatedAt = time.Now().UTC()

	if err := h.db.WithContext(c.Context()).
		Model(&tenant).
		Select("Status", "IsActive", "UpdatedAt").
		Updates(&tenant).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update tenant status"})
	}

	return c.JSON(toTenantResponse(tenant))
}

func toTenantResponse(t models.Tenant) dto.TenantResponse {
	return dto.TenantResponse{
		ID:           t.ID.String(),
		Name:         t.Name,
		NIT:          t.NIT,
		Domain:       t.Domain,
		ContactEmail: t.ContactEmail,
		Status:       t.Status,
		IsActive:     t.IsActive,
		CreatedAt:    t.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:    t.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "sqlstate 23505")
}
