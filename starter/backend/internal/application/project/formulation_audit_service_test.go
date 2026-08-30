package project_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type mockProjectReader struct {
	project *models.Project
	err     error
}

func (m *mockProjectReader) FindOwned(_ context.Context, _, _ uuid.UUID) (*models.Project, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.project, nil
}

type mockMgaCounter struct {
	causes     int64
	objectives int64
	err        error
}

func (m *mockMgaCounter) CountCauses(_ context.Context, _, _ uuid.UUID) (int64, error) {
	if m.err != nil {
		return 0, m.err
	}
	return m.causes, nil
}

func (m *mockMgaCounter) CountSpecificObjectives(_ context.Context, _, _ uuid.UUID) (int64, error) {
	if m.err != nil {
		return 0, m.err
	}
	return m.objectives, nil
}

func completeProject() *models.Project {
	return &models.Project{
		ProblemDescription: "Falta de acceso a agua potable.",
		GeneralObjective:   "Mejorar el acceso al servicio de acueducto.",
	}
}

func TestFormulationAuditService_Passed(t *testing.T) {
	svc := appproject.NewFormulationAuditService(
		&mockProjectReader{project: completeProject()},
		&mockMgaCounter{causes: 2, objectives: 1},
	)

	result, err := svc.AuditProject(context.Background(), uuid.New(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	if !result.Passed {
		t.Fatalf("expected passed, blockers: %v", result.Blockers)
	}
	if len(result.Warnings) != 0 {
		t.Fatalf("expected empty warnings, got %v", result.Warnings)
	}
}

func TestFormulationAuditService_Blockers(t *testing.T) {
	tests := []struct {
		name     string
		project  *models.Project
		causes   int64
		obj      int64
		contains string
	}{
		{
			name: "missing problem",
			project: &models.Project{
				GeneralObjective: "Objetivo general.",
			},
			causes:   1,
			obj:      1,
			contains: "descripción del problema",
		},
		{
			name: "missing general objective",
			project: &models.Project{
				ProblemDescription: "Problema definido.",
			},
			causes:   1,
			obj:      1,
			contains: "objetivo general",
		},
		{
			name:     "no causes",
			project:  completeProject(),
			causes:   0,
			obj:      1,
			contains: "al menos una causa",
		},
		{
			name:     "no specific objectives",
			project:  completeProject(),
			causes:   1,
			obj:      0,
			contains: "objetivo específico",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			svc := appproject.NewFormulationAuditService(
				&mockProjectReader{project: tc.project},
				&mockMgaCounter{causes: tc.causes, objectives: tc.obj},
			)
			result, err := svc.AuditProject(context.Background(), uuid.New(), uuid.New())
			if err != nil {
				t.Fatal(err)
			}
			if result.Passed {
				t.Fatal("expected audit to fail")
			}
			found := false
			for _, b := range result.Blockers {
				if strings.Contains(strings.ToLower(b), strings.ToLower(tc.contains)) {
					found = true
					break
				}
			}
			if !found {
				t.Fatalf("expected blocker containing %q, got %v", tc.contains, result.Blockers)
			}
		})
	}
}

func TestFormulationAuditService_ProjectNotFound(t *testing.T) {
	svc := appproject.NewFormulationAuditService(
		&mockProjectReader{err: gorm.ErrRecordNotFound},
		&mockMgaCounter{},
	)
	_, err := svc.AuditProject(context.Background(), uuid.New(), uuid.New())
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}
}
