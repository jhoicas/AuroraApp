package handlers

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// GetFullFormulation retorna el estado MGA completo del proyecto.
func (h *MgaHandler) GetFullFormulation(c *fiber.Ctx) error {
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

	bundle, err := h.repo.GetFullFormulation(c.Context(), projectID, tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load mga formulation"})
	}

	return c.JSON(toFullMgaFormulationResponse(bundle))
}

// --- Efectos ---

func (h *MgaHandler) CreateEffect(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	var req dto.CreateMgaEffectRequest
	if err := parseAndValidateMgaBody(c, &req); err != nil {
		return err
	}

	parentID, err := h.resolveMgaParentEffect(c, req.ParentID, projectID, tenantID)
	if err != nil {
		return err
	}

	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	now := time.Now().UTC()
	effect := &models.MgaEffect{
		ID:          uuid.New(),
		TenantID:    tenantID,
		ProjectID:   projectID,
		ParentID:    parentID,
		EffectType:  req.EffectType,
		Description: strings.TrimSpace(req.Description),
		SortOrder:   sortOrder,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := h.repo.CreateEffect(c.Context(), effect); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create effect"})
	}

	return c.Status(fiber.StatusCreated).JSON(toMgaEffectResponse(*effect))
}

func (h *MgaHandler) UpdateEffect(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	effectID, err := uuid.Parse(c.Params("effectId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid effect id"})
	}

	effect, err := h.repo.FindEffect(c.Context(), effectID, projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "effect not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load effect"})
	}

	var req dto.UpdateMgaEffectRequest
	if err := parseAndValidateMgaBody(c, &req); err != nil {
		return err
	}

	if req.EffectType != nil {
		effect.EffectType = *req.EffectType
	}
	if req.Description != nil {
		effect.Description = strings.TrimSpace(*req.Description)
	}
	if req.ParentID != nil {
		if strings.TrimSpace(*req.ParentID) == "" {
			effect.ParentID = nil
		} else {
			parentID, err := h.resolveMgaParentEffect(c, req.ParentID, projectID, tenantID)
			if err != nil {
				return err
			}
			effect.ParentID = parentID
		}
	}
	if req.SortOrder != nil {
		effect.SortOrder = *req.SortOrder
	}
	effect.UpdatedAt = time.Now().UTC()

	if err := h.repo.UpdateEffect(c.Context(), effect); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update effect"})
	}

	return c.JSON(toMgaEffectResponse(*effect))
}

func (h *MgaHandler) DeleteEffect(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	effectID, err := uuid.Parse(c.Params("effectId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid effect id"})
	}

	if err := h.repo.DeleteEffect(c.Context(), effectID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "effect not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete effect"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// --- Participantes ---

func (h *MgaHandler) CreateParticipant(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	var req dto.CreateMgaParticipantRequest
	if err := parseAndValidateMgaBody(c, &req); err != nil {
		return err
	}

	now := time.Now().UTC()
	participant := &models.MgaParticipant{
		ID:           uuid.New(),
		TenantID:     tenantID,
		ProjectID:    projectID,
		Actor:        strings.TrimSpace(req.Actor),
		Entity:       strings.TrimSpace(req.Entity),
		Position:     strings.TrimSpace(req.Position),
		Interests:    strings.TrimSpace(req.Interests),
		Contribution: strings.TrimSpace(req.Contribution),
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := h.repo.CreateParticipant(c.Context(), participant); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create participant"})
	}

	return c.Status(fiber.StatusCreated).JSON(toMgaParticipantResponse(*participant))
}

func (h *MgaHandler) UpdateParticipant(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	participantID, err := uuid.Parse(c.Params("participantId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid participant id"})
	}

	participant, err := h.repo.FindParticipant(c.Context(), participantID, projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "participant not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load participant"})
	}

	var req dto.UpdateMgaParticipantRequest
	if err := parseAndValidateMgaBody(c, &req); err != nil {
		return err
	}

	if req.Actor != nil {
		participant.Actor = strings.TrimSpace(*req.Actor)
	}
	if req.Entity != nil {
		participant.Entity = strings.TrimSpace(*req.Entity)
	}
	if req.Position != nil {
		participant.Position = strings.TrimSpace(*req.Position)
	}
	if req.Interests != nil {
		participant.Interests = strings.TrimSpace(*req.Interests)
	}
	if req.Contribution != nil {
		participant.Contribution = strings.TrimSpace(*req.Contribution)
	}
	participant.UpdatedAt = time.Now().UTC()

	if err := h.repo.UpdateParticipant(c.Context(), participant); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update participant"})
	}

	return c.JSON(toMgaParticipantResponse(*participant))
}

func (h *MgaHandler) DeleteParticipant(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	participantID, err := uuid.Parse(c.Params("participantId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid participant id"})
	}

	if err := h.repo.DeleteParticipant(c.Context(), participantID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "participant not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete participant"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// --- Población ---

func (h *MgaHandler) CreatePopulation(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	var req dto.CreateMgaPopulationRequest
	if err := parseAndValidateMgaBody(c, &req); err != nil {
		return err
	}

	locations, err := normalizeMgaLocations(req.Locations)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	now := time.Now().UTC()
	population := &models.MgaPopulation{
		ID:             uuid.New(),
		TenantID:       tenantID,
		ProjectID:      projectID,
		PopulationType: req.PopulationType,
		TotalNumber:    req.TotalNumber,
		Source:         strings.TrimSpace(req.Source),
		Locations:      locations,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := h.repo.CreatePopulation(c.Context(), population); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create population"})
	}

	return c.Status(fiber.StatusCreated).JSON(toMgaPopulationResponse(*population))
}

func (h *MgaHandler) UpdatePopulation(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	populationID, err := uuid.Parse(c.Params("populationId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid population id"})
	}

	population, err := h.repo.FindPopulation(c.Context(), populationID, projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "population not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load population"})
	}

	var req dto.UpdateMgaPopulationRequest
	if err := parseAndValidateMgaBody(c, &req); err != nil {
		return err
	}

	if req.PopulationType != nil {
		population.PopulationType = *req.PopulationType
	}
	if req.TotalNumber != nil {
		population.TotalNumber = *req.TotalNumber
	}
	if req.Source != nil {
		population.Source = strings.TrimSpace(*req.Source)
	}
	if req.Locations != nil {
		locations, err := normalizeMgaLocations(*req.Locations)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		population.Locations = locations
	}
	population.UpdatedAt = time.Now().UTC()

	if err := h.repo.UpdatePopulation(c.Context(), population); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update population"})
	}

	return c.JSON(toMgaPopulationResponse(*population))
}

func (h *MgaHandler) DeletePopulation(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	populationID, err := uuid.Parse(c.Params("populationId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid population id"})
	}

	if err := h.repo.DeletePopulation(c.Context(), populationID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "population not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete population"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// --- Alternativas ---

func (h *MgaHandler) CreateAlternative(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	var req dto.CreateMgaAlternativeRequest
	if err := parseAndValidateMgaBody(c, &req); err != nil {
		return err
	}

	now := time.Now().UTC()
	alternative := &models.MgaAlternative{
		ID:                    uuid.New(),
		TenantID:              tenantID,
		ProjectID:             projectID,
		Description:           strings.TrimSpace(req.Description),
		EvaluateProfitability: req.EvaluateProfitability,
		EvaluateCost:          req.EvaluateCost,
		ProceedsToPreparation: req.ProceedsToPreparation,
		CreatedAt:             now,
		UpdatedAt:             now,
	}

	if err := h.repo.CreateAlternative(c.Context(), alternative); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create alternative"})
	}

	return c.Status(fiber.StatusCreated).JSON(toMgaAlternativeResponse(*alternative))
}

func (h *MgaHandler) UpdateAlternative(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	alternativeID, err := uuid.Parse(c.Params("alternativeId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid alternative id"})
	}

	alternative, err := h.repo.FindAlternative(c.Context(), alternativeID, projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "alternative not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load alternative"})
	}

	var req dto.UpdateMgaAlternativeRequest
	if err := parseAndValidateMgaBody(c, &req); err != nil {
		return err
	}

	if req.Description != nil {
		alternative.Description = strings.TrimSpace(*req.Description)
	}
	if req.EvaluateProfitability != nil {
		alternative.EvaluateProfitability = *req.EvaluateProfitability
	}
	if req.EvaluateCost != nil {
		alternative.EvaluateCost = *req.EvaluateCost
	}
	if req.ProceedsToPreparation != nil {
		alternative.ProceedsToPreparation = *req.ProceedsToPreparation
	}
	alternative.UpdatedAt = time.Now().UTC()

	if err := h.repo.UpdateAlternative(c.Context(), alternative); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update alternative"})
	}

	return c.JSON(toMgaAlternativeResponse(*alternative))
}

func (h *MgaHandler) DeleteAlternative(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	alternativeID, err := uuid.Parse(c.Params("alternativeId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid alternative id"})
	}

	if err := h.repo.DeleteAlternative(c.Context(), alternativeID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "alternative not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete alternative"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// --- Helpers ---

func (h *MgaHandler) parseMgaProjectContext(c *fiber.Ctx) (uuid.UUID, uuid.UUID, error) {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return uuid.Nil, uuid.Nil, c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, uuid.Nil, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	if _, err := loadOwnedProject(h.db, c.Context(), projectID, tenantID); err != nil {
		if isNotFound(err) {
			return uuid.Nil, uuid.Nil, c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return uuid.Nil, uuid.Nil, c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify project ownership"})
	}

	return projectID, tenantID, nil
}

func parseAndValidateMgaBody(c *fiber.Ctx, req any) error {
	if err := c.BodyParser(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	return nil
}

func (h *MgaHandler) resolveMgaParentEffect(c *fiber.Ctx, parentIDRaw *string, projectID, tenantID uuid.UUID) (*uuid.UUID, error) {
	if parentIDRaw == nil || strings.TrimSpace(*parentIDRaw) == "" {
		return nil, nil
	}

	parsed, err := uuid.Parse(strings.TrimSpace(*parentIDRaw))
	if err != nil {
		return nil, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid parent_id"})
	}

	if _, err := h.repo.FindEffect(c.Context(), parsed, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return nil, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "parent effect not found"})
		}
		return nil, c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify parent effect"})
	}

	return &parsed, nil
}

func normalizeMgaLocations(raw json.RawMessage) (string, error) {
	if len(raw) == 0 {
		return "[]", nil
	}
	if !json.Valid(raw) {
		return "", errors.New("locations must be valid JSON")
	}
	return string(raw), nil
}

func toFullMgaFormulationResponse(bundle *postgres.MgaFullFormulation) dto.FullMgaFormulationResponse {
	causes := make([]dto.MgaCauseResponse, 0, len(bundle.Causes))
	for _, cause := range bundle.Causes {
		causes = append(causes, toMgaCauseResponse(cause))
	}

	effects := make([]dto.MgaEffectResponse, 0, len(bundle.Effects))
	for _, effect := range bundle.Effects {
		effects = append(effects, toMgaEffectResponse(effect))
	}

	indicators := make([]dto.MgaIndicatorResponse, 0, len(bundle.Indicators))
	for _, indicator := range bundle.Indicators {
		indicators = append(indicators, toMgaIndicatorResponse(indicator))
	}

	participants := make([]dto.MgaParticipantResponse, 0, len(bundle.Participants))
	for _, participant := range bundle.Participants {
		participants = append(participants, toMgaParticipantResponse(participant))
	}

	populations := make([]dto.MgaPopulationResponse, 0, len(bundle.Populations))
	for _, population := range bundle.Populations {
		populations = append(populations, toMgaPopulationResponse(population))
	}

	alternatives := make([]dto.MgaAlternativeResponse, 0, len(bundle.Alternatives))
	for _, alternative := range bundle.Alternatives {
		alternatives = append(alternatives, toMgaAlternativeResponse(alternative))
	}

	return dto.FullMgaFormulationResponse{
		Causes:       causes,
		Effects:      effects,
		Indicators:   indicators,
		Participants: participants,
		Populations:  populations,
		Alternatives: alternatives,
	}
}

func toMgaEffectResponse(effect models.MgaEffect) dto.MgaEffectResponse {
	var parentID *string
	if effect.ParentID != nil {
		s := effect.ParentID.String()
		parentID = &s
	}

	return dto.MgaEffectResponse{
		ID:          effect.ID.String(),
		TenantID:    effect.TenantID.String(),
		ProjectID:   effect.ProjectID.String(),
		ParentID:    parentID,
		EffectType:  effect.EffectType,
		Description: effect.Description,
		SortOrder:   effect.SortOrder,
		CreatedAt:   effect.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:   effect.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func toMgaParticipantResponse(participant models.MgaParticipant) dto.MgaParticipantResponse {
	return dto.MgaParticipantResponse{
		ID:           participant.ID.String(),
		TenantID:     participant.TenantID.String(),
		ProjectID:    participant.ProjectID.String(),
		Actor:        participant.Actor,
		Entity:       participant.Entity,
		Position:     participant.Position,
		Interests:    participant.Interests,
		Contribution: participant.Contribution,
		CreatedAt:    participant.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:    participant.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func toMgaPopulationResponse(population models.MgaPopulation) dto.MgaPopulationResponse {
	locations := json.RawMessage(population.Locations)
	if len(locations) == 0 {
		locations = json.RawMessage("[]")
	}

	return dto.MgaPopulationResponse{
		ID:             population.ID.String(),
		TenantID:       population.TenantID.String(),
		ProjectID:      population.ProjectID.String(),
		PopulationType: population.PopulationType,
		TotalNumber:    population.TotalNumber,
		Source:         population.Source,
		Locations:      locations,
		CreatedAt:      population.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:      population.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func toMgaAlternativeResponse(alternative models.MgaAlternative) dto.MgaAlternativeResponse {
	return dto.MgaAlternativeResponse{
		ID:                    alternative.ID.String(),
		TenantID:              alternative.TenantID.String(),
		ProjectID:             alternative.ProjectID.String(),
		Description:           alternative.Description,
		EvaluateProfitability: alternative.EvaluateProfitability,
		EvaluateCost:          alternative.EvaluateCost,
		ProceedsToPreparation: alternative.ProceedsToPreparation,
		CreatedAt:             alternative.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:             alternative.UpdatedAt.UTC().Format(time.RFC3339),
	}
}
