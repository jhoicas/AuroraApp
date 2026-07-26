package handlers

import (
	"math"
	"strconv"
	"strings"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProjectHandler struct {
	db *gorm.DB
}

func NewProjectHandler(db *gorm.DB) *ProjectHandler {
	return &ProjectHandler{db: db}
}

func (h *ProjectHandler) Create(c *fiber.Ctx) error {
	userID, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	var req dto.CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	req.Sector = strings.TrimSpace(req.Sector)
	if req.CodeBPIN != nil {
		bpin := strings.TrimSpace(*req.CodeBPIN)
		if bpin == "" {
			req.CodeBPIN = nil
		} else {
			req.CodeBPIN = &bpin
		}
	}

	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	now := time.Now().UTC()
	project := models.Project{
		ID:          uuid.New(),
		TenantID:    tenantID,
		CreatorID:   userID,
		Name:        req.Name,
		Description: req.Description,
		CodeBPIN:    req.CodeBPIN,
		Sector:      req.Sector,
		Status:      constants.ProjectStatusInFormulation,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := h.db.WithContext(c.Context()).Create(&project).Error; err != nil {
		if isUniqueViolation(err) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "project with same BPIN already exists for this tenant",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create project"})
	}

	return c.Status(fiber.StatusCreated).JSON(toProjectResponse(project))
}

func (h *ProjectHandler) List(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

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
	q := h.db.WithContext(c.Context()).
		Model(&models.Project{}).
		Where("tenant_id = ?", tenantID)

	if err := q.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count projects"})
	}

	var projects []models.Project
	if err := q.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&projects).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list projects"})
	}

	data := make([]dto.ProjectResponse, 0, len(projects))
	for _, p := range projects {
		data = append(data, toProjectResponse(p))
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))
	if totalPages == 0 {
		totalPages = 1
	}

	return c.JSON(dto.PaginatedProjectsResponse{
		Data:       data,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *ProjectHandler) GetByID(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	project, err := loadOwnedProject(h.db, c.Context(), id, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
	}

	return c.JSON(toProjectResponse(*project))
}

func (h *ProjectHandler) UpdateDetails(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	var req dto.UpdateProjectDetailsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.ProblemDescription = strings.TrimSpace(req.ProblemDescription)
	req.GeneralObjective = strings.TrimSpace(req.GeneralObjective)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	project, err := loadOwnedProject(h.db, c.Context(), id, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
	}

	project.ProblemDescription = req.ProblemDescription
	project.GeneralObjective = req.GeneralObjective
	project.UpdatedAt = time.Now().UTC()

	if err := h.db.WithContext(c.Context()).
		Model(project).
		Select("ProblemDescription", "GeneralObjective", "UpdatedAt").
		Updates(project).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update project details"})
	}

	return c.JSON(toProjectResponse(*project))
}

func toProjectResponse(p models.Project) dto.ProjectResponse {
	return dto.ProjectResponse{
		ID:                 p.ID.String(),
		TenantID:           p.TenantID.String(),
		CreatorID:          p.CreatorID.String(),
		Name:               p.Name,
		Description:        p.Description,
		CodeBPIN:           p.CodeBPIN,
		Sector:             p.Sector,
		ProblemDescription: p.ProblemDescription,
		GeneralObjective:   p.GeneralObjective,
		Status:             p.Status,
		CreatedAt:          p.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:          p.UpdatedAt.UTC().Format(time.RFC3339),
	}
}
