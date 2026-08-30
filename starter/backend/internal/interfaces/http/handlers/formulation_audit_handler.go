package handlers

import (
	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FormulationAuditHandler struct {
	svc *appproject.FormulationAuditService
}

func NewFormulationAuditHandler(db *gorm.DB) *FormulationAuditHandler {
	mgaRepo := postgres.NewMgaRepository(db)
	return NewFormulationAuditHandlerWithDeps(
		appproject.NewFormulationAuditService(postgres.NewProjectRepository(db), mgaRepo),
	)
}

func NewFormulationAuditHandlerWithDeps(svc *appproject.FormulationAuditService) *FormulationAuditHandler {
	return &FormulationAuditHandler{svc: svc}
}

// GetAuditReport GET /api/v1/projects/:id/audit
func (h *FormulationAuditHandler) GetAuditReport(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	result, err := h.svc.AuditProject(c.Context(), tenantID, projectID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "audit failed"})
	}

	return c.JSON(dto.FormulationAuditResponse{
		Passed:   result.Passed,
		Blockers: result.Blockers,
		Warnings: result.Warnings,
	})
}
