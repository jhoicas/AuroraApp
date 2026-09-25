package project_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/datatypes"
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
	causes            int64
	directCauses      *int64
	directEffects     *int64
	objectives        int64
	targetPopulations int64
	alternatives      int64
	err               error
}

func (m *mockMgaCounter) CountCauses(_ context.Context, _, _ uuid.UUID) (int64, error) {
	if m.err != nil {
		return 0, m.err
	}
	return m.causes, nil
}

func (m *mockMgaCounter) CountDirectCauses(_ context.Context, _, _ uuid.UUID) (int64, error) {
	if m.err != nil {
		return 0, m.err
	}
	if m.directCauses != nil {
		return *m.directCauses, nil
	}
	return m.causes, nil
}

func (m *mockMgaCounter) CountDirectEffects(_ context.Context, _, _ uuid.UUID) (int64, error) {
	if m.err != nil {
		return 0, m.err
	}
	if m.directEffects != nil {
		return *m.directEffects, nil
	}
	return 1, nil
}

func (m *mockMgaCounter) CountSpecificObjectives(_ context.Context, _, _ uuid.UUID) (int64, error) {
	if m.err != nil {
		return 0, m.err
	}
	return m.objectives, nil
}

func (m *mockMgaCounter) CountTargetPopulations(_ context.Context, _, _ uuid.UUID) (int64, error) {
	if m.err != nil {
		return 0, m.err
	}
	return m.targetPopulations, nil
}

func (m *mockMgaCounter) CountAlternatives(_ context.Context, _, _ uuid.UUID) (int64, error) {
	if m.err != nil {
		return 0, m.err
	}
	return m.alternatives, nil
}

type mockEdtActivityReader struct {
	activities []models.ProjectActivity
	err        error
}

func (m *mockEdtActivityReader) ListActivities(_ context.Context, _, _ uuid.UUID) ([]models.ProjectActivity, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.activities, nil
}

func completeProject() *models.Project {
	locJSON := []byte(`{"localizaciones": [{"regionId": 1, "departamentoId": 76, "municipioId": 1}]}`)
	return &models.Project{
		ProblemDescription: "Falta de acceso a agua potable.",
		GeneralObjective:   "Mejorar el acceso al servicio de acueducto.",
		SituacionExistente: strings.Repeat("Contexto territorial y social del problema. ", 4),
		MagnitudProblema:   strings.Repeat("Indicadores de magnitud y línea base verificable. ", 4),
		MgaFormulationData: datatypes.JSON(locJSON),
	}
}

func defaultMockEdt() *mockEdtActivityReader {
	return &mockEdtActivityReader{
		activities: []models.ProjectActivity{
			{
				Code:      "ACT-01",
				Name:      "Construcción de bocatoma",
				Quantity:  1,
				UnitCost:  50000000,
				TotalCost: 50000000,
			},
		},
	}
}

func TestFormulationAuditService_Passed(t *testing.T) {
	counter := &mockMgaCounter{
		causes:            2,
		objectives:        1,
		targetPopulations: 1,
		alternatives:      1,
	}
	svc := appproject.NewFormulationAuditService(
		&mockProjectReader{project: completeProject()},
		counter,
		defaultMockEdt(),
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
	if len(result.Findings) == 0 {
		t.Fatalf("expected structured findings, got none")
	}

	for _, f := range result.Findings {
		if f.Severity == "CRITICAL" {
			t.Fatalf("unexpected critical finding in passed project: %+v", f)
		}
	}
}

func TestFormulationAuditService_Blockers(t *testing.T) {
	tests := []struct {
		name       string
		project    *models.Project
		causes     int64
		obj        int64
		targetPop  int64
		alts       int64
		edt        *mockEdtActivityReader
		sectionKey string
		contains   string
	}{
		{
			name: "missing problem",
			project: &models.Project{
				GeneralObjective:   "Objetivo general.",
				MgaFormulationData: datatypes.JSON(`{"localizaciones":[{"regionId":1}]}`),
			},
			causes:     1,
			obj:        1,
			targetPop:  1,
			alts:       1,
			edt:        defaultMockEdt(),
			sectionKey: "identificacion",
			contains:   "descripción del problema",
		},
		{
			name: "missing general objective",
			project: &models.Project{
				ProblemDescription: "Problema definido.",
				MgaFormulationData: datatypes.JSON(`{"localizaciones":[{"regionId":1}]}`),
			},
			causes:     1,
			obj:        1,
			targetPop:  1,
			alts:       1,
			edt:        defaultMockEdt(),
			sectionKey: "objetivos",
			contains:   "objetivo general",
		},
		{
			name:       "no causes",
			project:    completeProject(),
			causes:     0,
			obj:        1,
			targetPop:  1,
			alts:       1,
			edt:        defaultMockEdt(),
			sectionKey: "identificacion",
			contains:   "causa",
		},
		{
			name:       "no specific objectives",
			project:    completeProject(),
			causes:     1,
			obj:        0,
			targetPop:  1,
			alts:       1,
			edt:        defaultMockEdt(),
			sectionKey: "objetivos",
			contains:   "objetivo específico",
		},
		{
			name:       "no target population",
			project:    completeProject(),
			causes:     1,
			obj:        1,
			targetPop:  0,
			alts:       1,
			edt:        defaultMockEdt(),
			sectionKey: "poblacion",
			contains:   "población objetivo",
		},
		{
			name: "no localization defined",
			project: &models.Project{
				ProblemDescription: "Problema.",
				GeneralObjective:   "Objetivo.",
				MgaFormulationData: datatypes.JSON(`{}`),
			},
			causes:     1,
			obj:        1,
			targetPop:  1,
			alts:       1,
			edt:        defaultMockEdt(),
			sectionKey: "localizacion",
			contains:   "localización",
		},
		{
			name:       "objectives without alternatives",
			project:    completeProject(),
			causes:     1,
			obj:        1,
			targetPop:  1,
			alts:       0,
			edt:        defaultMockEdt(),
			sectionKey: "alternativas",
			contains:   "alternativa",
		},
		{
			name:       "edt without activities",
			project:    completeProject(),
			causes:     1,
			obj:        1,
			targetPop:  1,
			alts:       1,
			edt:        &mockEdtActivityReader{activities: []models.ProjectActivity{}},
			sectionKey: "cadena-valor",
			contains:   "cadena de valor",
		},
		{
			name:      "edt activity with zero cost",
			project:   completeProject(),
			causes:    1,
			obj:       1,
			targetPop: 1,
			alts:      1,
			edt: &mockEdtActivityReader{
				activities: []models.ProjectActivity{
					{Code: "ACT-01", Name: "Estudio", Quantity: 1, UnitCost: 0, TotalCost: 0},
				},
			},
			sectionKey: "cadena-valor",
			contains:   "costo",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			counter := &mockMgaCounter{
				causes:            tc.causes,
				objectives:        tc.obj,
				targetPopulations: tc.targetPop,
				alternatives:      tc.alts,
			}
			svc := appproject.NewFormulationAuditService(
				&mockProjectReader{project: tc.project},
				counter,
				tc.edt,
			)
			result, err := svc.AuditProject(context.Background(), uuid.New(), uuid.New())
			if err != nil {
				t.Fatal(err)
			}
			if result.Passed {
				t.Fatal("expected audit to fail")
			}

			found := false
			for _, f := range result.Findings {
				if f.Severity == "CRITICAL" && f.SectionKey == tc.sectionKey &&
					strings.Contains(strings.ToLower(f.Message), strings.ToLower(tc.contains)) {
					found = true
					break
				}
			}
			if !found {
				t.Fatalf("expected CRITICAL finding in section %q containing %q, got: %+v",
					tc.sectionKey, tc.contains, result.Findings)
			}
		})
	}
}

func TestFormulationAuditService_ProjectNotFound(t *testing.T) {
	svc := appproject.NewFormulationAuditService(
		&mockProjectReader{err: gorm.ErrRecordNotFound},
		&mockMgaCounter{},
		defaultMockEdt(),
	)
	_, err := svc.AuditProject(context.Background(), uuid.New(), uuid.New())
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}
}
