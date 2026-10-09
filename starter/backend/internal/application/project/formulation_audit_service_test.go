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
	locJSON := []byte(`{"localizaciones": [{"regionId": 1, "departamentoId": 76, "municipioId": 1}], "planDesarrollo": {"municipal": "PDM 2024-2027"}}`)
	productCode := "4003012"
	return &models.Project{
		ProductCode:        &productCode,
		ProblemDescription: "Falta de acceso a agua potable en la zona rural del municipio.",
		GeneralObjective:   "Mejorar el acceso al servicio de acueducto.",
		SituacionExistente: strings.Repeat("Contexto territorial y social del problema. ", 4),
		MagnitudProblema:   strings.Repeat("Indicadores de magnitud y línea base verificable: 35% sin acceso (DANE 2023). ", 2),
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
			{
				Code:      "ACT-02",
				Name:      "Interventoría de obra",
				Quantity:  1,
				UnitCost:  10000000,
				TotalCost: 10000000,
			},
		},
	}
}

func TestFormulationAuditService_Passed(t *testing.T) {
	counter := &mockMgaCounter{
		causes:            2,
		objectives:        2,
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
	if result.OverallScore < 90 || result.Status != appproject.AuditStatusApproved {
		t.Fatalf("expected approved with high score, got %d %s", result.OverallScore, result.Status)
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
					{Code: "ACT-02", Name: "Obra", Quantity: 1, UnitCost: 10, TotalCost: 10},
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

func TestFormulationAuditService_HolisticResponseComplete(t *testing.T) {
	projectID := uuid.New()
	svc := appproject.NewFormulationAuditService(
		&mockProjectReader{project: completeProject()},
		&mockMgaCounter{causes: 2, objectives: 2, targetPopulations: 1, alternatives: 1},
		defaultMockEdt(),
	)
	result, err := svc.AuditProject(context.Background(), uuid.New(), projectID)
	if err != nil {
		t.Fatal(err)
	}
	if result.OverallScore != 100 || result.Status != appproject.AuditStatusApproved {
		t.Fatalf("expected 100/APROBADO, got %d/%s", result.OverallScore, result.Status)
	}
}

func TestFormulationAuditService_HolisticResponseIncomplete(t *testing.T) {
	projectID := uuid.New()
	project := &models.Project{
		ProblemDescription: "N/A",
		GeneralObjective:   "N/A",
		MagnitudProblema:   "Muchos casos sin dato",
		MgaFormulationData: datatypes.JSON(`{}`),
	}
	svc := appproject.NewFormulationAuditService(
		&mockProjectReader{project: project},
		&mockMgaCounter{causes: 2, objectives: 1, targetPopulations: 0, alternatives: 0},
		&mockEdtActivityReader{},
	)
	result, err := svc.AuditProject(context.Background(), uuid.New(), projectID)
	if err != nil {
		t.Fatal(err)
	}
	if result.Passed {
		t.Fatal("incomplete project must not pass")
	}
	if result.Status != appproject.AuditStatusRemediation {
		t.Fatalf("expected REQUIERE_SUBSANACION, got %s", result.Status)
	}
	if result.OverallScore < 0 || result.OverallScore >= 60 {
		t.Fatalf("expected low score, got %d", result.OverallScore)
	}

	byID := map[string]appproject.AuditFinding{}
	for _, f := range result.Findings {
		byID[f.ID] = f
		if f.Severity == "SUCCESS" {
			continue
		}
		if f.Title == "" || f.Description == "" || f.Section == "" || f.TabID == "" || f.Level == "" || f.TargetURL == "" {
			t.Fatalf("finding missing holistic fields: %+v", f)
		}
		if !strings.Contains(f.TargetURL, projectID.String()) || !strings.Contains(f.TargetURL, "tab="+f.TabID) {
			t.Fatalf("bad targetUrl: %s", f.TargetURL)
		}
	}

	cases := map[string]struct{ level, tab string }{
		"crit-target-population":    {"error", "poblacion"},
		"crit-alternatives":         {"error", "alternativas"},
		"warn-placeholder-text":     {"warning", "identificacion"},
		"warn-plan-desarrollo":      {"warning", "plan-desarrollo"},
		"sugg-magnitud-quant":       {"suggestion", "identificacion"},
		"crit-edt-activities-empty": {"error", "cadena-valor"},
	}
	for id, want := range cases {
		f, ok := byID[id]
		if !ok {
			t.Fatalf("expected finding %s, got ids %v", id, byID)
		}
		if f.Level != want.level || f.TabID != want.tab {
			t.Fatalf("%s: got level=%s tab=%s, want %+v", id, f.Level, f.TabID, want)
		}
	}
	if f := byID["crit-direct-effect"]; f.FieldKey == "" || !strings.Contains(f.TargetURL, "&focus="+f.FieldKey) {
		// effects count mock returns 1, so only check when present
		if _, present := byID["crit-direct-effect"]; present {
			t.Fatalf("expected focus in targetUrl: %+v", f)
		}
	}
}

func TestFormulationAuditService_ObjectivesDoNotCoverCauses(t *testing.T) {
	svc := appproject.NewFormulationAuditService(
		&mockProjectReader{project: completeProject()},
		&mockMgaCounter{causes: 3, objectives: 1, targetPopulations: 1, alternatives: 1},
		defaultMockEdt(),
	)
	result, err := svc.AuditProject(context.Background(), uuid.New(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != appproject.AuditStatusObservations {
		t.Fatalf("expected CON_OBSERVACIONES, got %s", result.Status)
	}
	found := false
	for _, f := range result.Findings {
		if f.ID == "warn-objectives-causes" && f.FieldKey == "objetivos-especificos" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected warn-objectives-causes finding")
	}
}
