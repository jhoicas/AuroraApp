package project

import (
	"context"
	"strings"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
)

// AuditResult resultado de la auditoría previa de formulación MGA.
type AuditResult struct {
	Passed   bool     `json:"passed"`
	Blockers []string `json:"blockers"`
	Warnings []string `json:"warnings"`
}

// ProjectReader resuelve proyectos con ownership multi-tenant.
type ProjectReader interface {
	FindOwned(ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error)
}

// MgaFormulationCounter expone conteos ligeros para auditoría (sin cargar filas completas).
type MgaFormulationCounter interface {
	CountCauses(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error)
	CountSpecificObjectives(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error)
}

// FormulationAuditService evalúa requisitos mínimos de formulación antes de viabilidad.
type FormulationAuditService struct {
	projects ProjectReader
	mga      MgaFormulationCounter
}

func NewFormulationAuditService(projects ProjectReader, mga MgaFormulationCounter) *FormulationAuditService {
	return &FormulationAuditService{projects: projects, mga: mga}
}

// AuditProject verifica blockers críticos de formulación MGA.
func (s *FormulationAuditService) AuditProject(
	ctx context.Context,
	tenantID, projectID uuid.UUID,
) (AuditResult, error) {
	project, err := s.projects.FindOwned(ctx, projectID, tenantID)
	if err != nil {
		return AuditResult{}, err
	}

	blockers := make([]string, 0, 4)

	if strings.TrimSpace(project.ProblemDescription) == "" {
		blockers = append(blockers, "El proyecto debe tener una descripción del problema.")
	}
	if strings.TrimSpace(project.GeneralObjective) == "" {
		blockers = append(blockers, "El proyecto debe tener un objetivo general.")
	}

	causeCount, err := s.mga.CountCauses(ctx, projectID, tenantID)
	if err != nil {
		return AuditResult{}, err
	}
	if causeCount == 0 {
		blockers = append(blockers, "Debe existir al menos una causa en la formulación MGA.")
	}

	objectiveCount, err := s.mga.CountSpecificObjectives(ctx, projectID, tenantID)
	if err != nil {
		return AuditResult{}, err
	}
	if objectiveCount == 0 {
		blockers = append(blockers, "Debe existir al menos un objetivo específico en la formulación MGA.")
	}

	return AuditResult{
		Passed:   len(blockers) == 0,
		Blockers: blockers,
		Warnings: []string{},
	}, nil
}
