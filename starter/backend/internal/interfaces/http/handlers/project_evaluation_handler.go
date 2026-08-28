package handlers

import (
	"encoding/json"
	"strconv"
	"strings"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProjectEvaluationHandler struct {
	svc      *appproject.EvaluationService
	projects ProjectFinder
}

func NewProjectEvaluationHandler(db *gorm.DB) *ProjectEvaluationHandler {
	repo := postgres.NewProjectEvaluationRepository(db)
	return NewProjectEvaluationHandlerWithDeps(
		appproject.NewEvaluationService(repo),
		postgres.NewProjectRepository(db),
	)
}

// NewProjectEvaluationHandlerWithDeps inyección explícita de dependencias (tests / DI).
func NewProjectEvaluationHandlerWithDeps(svc *appproject.EvaluationService, projects ProjectFinder) *ProjectEvaluationHandler {
	return &ProjectEvaluationHandler{svc: svc, projects: projects}
}

// Evaluate POST /api/v1/projects/:id/evaluate
func (h *ProjectEvaluationHandler) Evaluate(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	project, err := h.projects.FindOwned(c.Context(), projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
	}

	var req dto.EvaluateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	alts := make([]appproject.AlternativeInput, 0, len(req.Alternatives))
	for _, a := range req.Alternatives {
		alts = append(alts, appproject.AlternativeInput{
			Name:      strings.TrimSpace(a.Name),
			CashFlows: a.CashFlows,
		})
	}

	results, err := h.svc.EvaluateAndPersist(c.Context(), project.ID, tenantID, appproject.EvaluateRequest{
		DiscountRate: req.DiscountRate,
		Alternatives: alts,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "evaluation failed"})
	}

	out := make([]dto.EvaluationResultDTO, 0, len(results))
	for _, r := range results {
		out = append(out, dto.EvaluationResultDTO{
			AlternativeName: r.AlternativeName,
			DiscountRate:    r.DiscountRate,
			CashFlows:       r.CashFlows,
			VPN:             r.VPN,
			TIR:             r.TIR,
		})
	}

	return c.JSON(dto.EvaluateProjectResponse{
		ProjectID:   project.ID.String(),
		Evaluations: out,
	})
}

// ListEvaluations GET /api/v1/projects/:id/evaluations
func (h *ProjectEvaluationHandler) ListEvaluations(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	rows, err := h.svc.ListByProject(c.Context(), projectID, tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load evaluations"})
	}

	out := make([]dto.EvaluationResultDTO, 0, len(rows))
	for _, row := range rows {
		var flows []float64
		_ = json.Unmarshal([]byte(row.CashFlows), &flows)
		out = append(out, dto.EvaluationResultDTO{
			AlternativeName: row.AlternativeName,
			DiscountRate:    row.DiscountRate,
			CashFlows:       flows,
			VPN:             row.VPN,
			TIR:             row.TIR,
		})
	}

	return c.JSON(fiber.Map{"data": out})
}

// ListTenantEvaluations GET /api/v1/projects/evaluations/summary
func (h *ProjectEvaluationHandler) ListTenantEvaluations(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	rows, err := h.svc.ListLatestByTenant(c.Context(), tenantID, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load evaluations"})
	}

	type summaryItem struct {
		ProjectID       string   `json:"project_id"`
		AlternativeName string   `json:"alternative_name"`
		VPN             float64  `json:"vpn"`
		TIR             *float64 `json:"tir,omitempty"`
		CreatedAt       string   `json:"created_at"`
	}

	data := make([]summaryItem, 0, len(rows))
	for _, row := range rows {
		data = append(data, summaryItem{
			ProjectID:       row.ProjectID.String(),
			AlternativeName: row.AlternativeName,
			VPN:             row.VPN,
			TIR:             row.TIR,
			CreatedAt:       row.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		})
	}

	return c.JSON(fiber.Map{"data": data})
}
