package handlers

import (
	"strings"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MgaHandler struct {
	db   *gorm.DB
	repo *postgres.MgaRepository
}

func NewMgaHandler(db *gorm.DB) *MgaHandler {
	return &MgaHandler{db: db, repo: postgres.NewMgaRepository(db)}
}

func (h *MgaHandler) GetFormulation(c *fiber.Ctx) error {
	return h.GetFullFormulation(c)
}

func (h *MgaHandler) ListCauses(c *fiber.Ctx) error {
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

	causes, err := h.repo.ListCauses(c.Context(), projectID, tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list mga causes"})
	}

	data := make([]dto.MgaCauseResponse, 0, len(causes))
	for _, cause := range causes {
		data = append(data, toMgaCauseResponse(cause))
	}
	return c.JSON(data)
}

func (h *MgaHandler) CreateCause(c *fiber.Ctx) error {
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

	var req dto.CreateMgaCauseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Description = strings.TrimSpace(req.Description)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var parentID *uuid.UUID
	if req.ParentID != nil && strings.TrimSpace(*req.ParentID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*req.ParentID))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid parent_id"})
		}
		if _, err := h.repo.FindCause(c.Context(), parsed, projectID, tenantID); err != nil {
			if isNotFound(err) {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "parent cause not found"})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify parent cause"})
		}
		parentID = &parsed
	}

	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	now := time.Now().UTC()
	cause := &models.MgaCause{
		ID:          uuid.New(),
		TenantID:    tenantID,
		ProjectID:   projectID,
		ParentID:    parentID,
		CauseType:   req.CauseType,
		Description: req.Description,
		SortOrder:   sortOrder,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	var objective *models.MgaSpecificObjective
	if req.SpecificObjective != nil && strings.TrimSpace(*req.SpecificObjective) != "" {
		objective = &models.MgaSpecificObjective{
			ID:          uuid.New(),
			Description: strings.TrimSpace(*req.SpecificObjective),
			CreatedAt:   now,
			UpdatedAt:   now,
		}
	}

	if err := h.repo.CreateCause(c.Context(), cause, objective); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create mga cause"})
	}

	created, err := h.repo.FindCause(c.Context(), cause.ID, projectID, tenantID)
	if err != nil {
		return c.Status(fiber.StatusCreated).JSON(toMgaCauseResponse(*cause))
	}
	return c.Status(fiber.StatusCreated).JSON(toMgaCauseResponse(*created))
}

func (h *MgaHandler) UpdateCause(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	causeID, err := uuid.Parse(c.Params("causeId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid cause id"})
	}

	cause, err := h.repo.FindCause(c.Context(), causeID, projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "cause not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load cause"})
	}

	var req dto.UpdateMgaCauseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.CauseType != nil {
		cause.CauseType = *req.CauseType
	}
	if req.Description != nil {
		cause.Description = strings.TrimSpace(*req.Description)
	}
	if req.ParentID != nil {
		if strings.TrimSpace(*req.ParentID) == "" {
			cause.ParentID = nil
		} else {
			parsed, err := uuid.Parse(strings.TrimSpace(*req.ParentID))
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid parent_id"})
			}
			cause.ParentID = &parsed
		}
	}
	if req.SortOrder != nil {
		cause.SortOrder = *req.SortOrder
	}
	cause.UpdatedAt = time.Now().UTC()

	if err := h.repo.UpdateCause(c.Context(), cause); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update cause"})
	}

	updated, err := h.repo.FindCause(c.Context(), causeID, projectID, tenantID)
	if err != nil {
		return c.JSON(toMgaCauseResponse(*cause))
	}
	return c.JSON(toMgaCauseResponse(*updated))
}

func (h *MgaHandler) DeleteCause(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	causeID, err := uuid.Parse(c.Params("causeId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid cause id"})
	}

	if _, err := loadOwnedProject(h.db, c.Context(), projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify project ownership"})
	}

	if err := h.repo.DeleteCause(c.Context(), causeID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "cause not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete cause"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *MgaHandler) UpdateObjective(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	objectiveID, err := uuid.Parse(c.Params("objId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid objective id"})
	}

	objective, err := h.repo.FindObjective(c.Context(), objectiveID, projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "objective not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load objective"})
	}

	var req dto.UpdateMgaObjectiveRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Description = strings.TrimSpace(req.Description)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	objective.Description = req.Description
	objective.UpdatedAt = time.Now().UTC()

	if err := h.repo.UpdateObjective(c.Context(), objective); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update objective"})
	}

	return c.JSON(toMgaObjectiveResponse(*objective))
}

func (h *MgaHandler) ListIndicators(c *fiber.Ctx) error {
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

	indicators, err := h.repo.ListIndicators(c.Context(), projectID, tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list indicators"})
	}

	data := make([]dto.MgaIndicatorResponse, 0, len(indicators))
	for _, indicator := range indicators {
		data = append(data, toMgaIndicatorResponse(indicator))
	}
	return c.JSON(data)
}

func (h *MgaHandler) CreateIndicator(c *fiber.Ctx) error {
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

	var req dto.CreateMgaIndicatorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Unit = strings.TrimSpace(req.Unit)
	req.SourceType = strings.TrimSpace(req.SourceType)
	req.VerificationSource = strings.TrimSpace(req.VerificationSource)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var specificObjectiveID *uuid.UUID
	if req.SpecificObjectiveID != nil && strings.TrimSpace(*req.SpecificObjectiveID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*req.SpecificObjectiveID))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid specific_objective_id"})
		}
		if _, err := h.repo.FindObjective(c.Context(), parsed, projectID, tenantID); err != nil {
			if isNotFound(err) {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "specific objective not found"})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify specific objective"})
		}
		specificObjectiveID = &parsed
	}

	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	now := time.Now().UTC()
	indicator := &models.MgaIndicator{
		ID:                  uuid.New(),
		TenantID:            tenantID,
		ProjectID:           projectID,
		SpecificObjectiveID: specificObjectiveID,
		Name:                req.Name,
		Unit:                req.Unit,
		Target:              req.Target,
		SourceType:          req.SourceType,
		VerificationSource:  req.VerificationSource,
		SortOrder:           sortOrder,
		CreatedAt:           now,
		UpdatedAt:           now,
	}

	if err := h.repo.CreateIndicator(c.Context(), indicator); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create indicator"})
	}

	return c.Status(fiber.StatusCreated).JSON(toMgaIndicatorResponse(*indicator))
}

func (h *MgaHandler) UpdateIndicator(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	indicatorID, err := uuid.Parse(c.Params("indicatorId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid indicator id"})
	}

	indicator, err := h.repo.FindIndicator(c.Context(), indicatorID, projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "indicator not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load indicator"})
	}

	var req dto.UpdateMgaIndicatorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if req.Name != nil {
		indicator.Name = strings.TrimSpace(*req.Name)
	}
	if req.Unit != nil {
		indicator.Unit = strings.TrimSpace(*req.Unit)
	}
	if req.Target != nil {
		indicator.Target = *req.Target
	}
	if req.SourceType != nil {
		indicator.SourceType = strings.TrimSpace(*req.SourceType)
	}
	if req.VerificationSource != nil {
		indicator.VerificationSource = strings.TrimSpace(*req.VerificationSource)
	}
	if req.SpecificObjectiveID != nil {
		if strings.TrimSpace(*req.SpecificObjectiveID) == "" {
			indicator.SpecificObjectiveID = nil
		} else {
			parsed, err := uuid.Parse(strings.TrimSpace(*req.SpecificObjectiveID))
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid specific_objective_id"})
			}
			indicator.SpecificObjectiveID = &parsed
		}
	}
	if req.SortOrder != nil {
		indicator.SortOrder = *req.SortOrder
	}
	indicator.UpdatedAt = time.Now().UTC()

	if err := h.repo.UpdateIndicator(c.Context(), indicator); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update indicator"})
	}

	return c.JSON(toMgaIndicatorResponse(*indicator))
}

func (h *MgaHandler) DeleteIndicator(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	indicatorID, err := uuid.Parse(c.Params("indicatorId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid indicator id"})
	}

	if _, err := loadOwnedProject(h.db, c.Context(), projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify project ownership"})
	}

	if err := h.repo.DeleteIndicator(c.Context(), indicatorID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "indicator not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete indicator"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func toMgaCauseResponse(cause models.MgaCause) dto.MgaCauseResponse {
	var parentID *string
	if cause.ParentID != nil {
		s := cause.ParentID.String()
		parentID = &s
	}

	resp := dto.MgaCauseResponse{
		ID:          cause.ID.String(),
		TenantID:    cause.TenantID.String(),
		ProjectID:   cause.ProjectID.String(),
		ParentID:    parentID,
		CauseType:   cause.CauseType,
		Description: cause.Description,
		SortOrder:   cause.SortOrder,
		CreatedAt:   cause.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:   cause.UpdatedAt.UTC().Format(time.RFC3339),
	}

	if cause.SpecificObjective != nil && cause.SpecificObjective.ID != uuid.Nil {
		obj := toMgaObjectiveResponse(*cause.SpecificObjective)
		resp.SpecificObjective = &obj
	}

	return resp
}

func toMgaObjectiveResponse(objective models.MgaSpecificObjective) dto.MgaSpecificObjectiveResponse {
	return dto.MgaSpecificObjectiveResponse{
		ID:          objective.ID.String(),
		TenantID:    objective.TenantID.String(),
		ProjectID:   objective.ProjectID.String(),
		CauseID:     objective.CauseID.String(),
		Description: objective.Description,
		CreatedAt:   objective.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:   objective.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func toMgaIndicatorResponse(indicator models.MgaIndicator) dto.MgaIndicatorResponse {
	var specificObjectiveID *string
	if indicator.SpecificObjectiveID != nil {
		s := indicator.SpecificObjectiveID.String()
		specificObjectiveID = &s
	}

	return dto.MgaIndicatorResponse{
		ID:                  indicator.ID.String(),
		TenantID:            indicator.TenantID.String(),
		ProjectID:           indicator.ProjectID.String(),
		SpecificObjectiveID: specificObjectiveID,
		Name:                indicator.Name,
		Unit:                indicator.Unit,
		Target:              indicator.Target,
		SourceType:          indicator.SourceType,
		VerificationSource:  indicator.VerificationSource,
		SortOrder:           indicator.SortOrder,
		CreatedAt:           indicator.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:           indicator.UpdatedAt.UTC().Format(time.RFC3339),
	}
}
