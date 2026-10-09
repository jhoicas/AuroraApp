package project_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
)

type mockDnpVerbReader struct {
	verbs []models.DnpVerb
	err   error
}

func (m *mockDnpVerbReader) ListDnpVerbs(_ context.Context) ([]models.DnpVerb, error) {
	return m.verbs, m.err
}

func dnpDict() *mockDnpVerbReader {
	return &mockDnpVerbReader{verbs: []models.DnpVerb{
		{Verb: "Elaborar", Kind: models.DnpVerbKindStrong},
		{Verb: "Diseñar", Kind: models.DnpVerbKindStrong},
		{Verb: "Fortalecer", Kind: models.DnpVerbKindWeak},
		{Verb: "Garantizar", Kind: models.DnpVerbKindWeak},
	}}
}

func activitiesEdt(names ...string) *mockEdtActivityReader {
	acts := make([]models.ProjectActivity, 0, len(names))
	for i, n := range names {
		acts = append(acts, models.ProjectActivity{
			Code: "ACT-0" + string(rune('1'+i)), Name: n, Quantity: 1, UnitCost: 1000, TotalCost: 1000,
		})
	}
	return &mockEdtActivityReader{activities: acts}
}

func auditWith(t *testing.T, edt *mockEdtActivityReader, verbs appproject.DnpVerbReader) *appproject.AuditResult {
	t.Helper()
	counter := &mockMgaCounter{causes: 2, objectives: 2, targetPopulations: 1, alternatives: 1}
	svc := appproject.NewFormulationAuditService(&mockProjectReader{project: completeProject()}, counter, edt)
	if verbs != nil {
		svc = svc.WithDnpVerbs(verbs)
	}
	res, err := svc.AuditProject(context.Background(), uuid.New(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	return &res
}

func findFinding(res *appproject.AuditResult, id string) *appproject.AuditFinding {
	for i := range res.Findings {
		if res.Findings[i].ID == id {
			return &res.Findings[i]
		}
	}
	return nil
}

func TestAuditDnpVerbs_WeakVerbFlagged(t *testing.T) {
	res := auditWith(t, activitiesEdt(
		"Fortalecer capacidades institucionales del municipio",
		"Elaborar el plan de menús y especificaciones técnicas",
	), dnpDict())

	f := findFinding(res, "warn-activity-weak-verb")
	if f == nil {
		t.Fatalf("expected warn-activity-weak-verb, got %+v", res.Findings)
	}
	if f.Severity != "WARNING" || f.SectionKey != "cadena-valor" {
		t.Fatalf("unexpected severity/section: %+v", f)
	}
	if !strings.Contains(f.Message, "Fortalecer capacidades") || strings.Contains(f.Message, "Elaborar el plan") {
		t.Fatalf("message must list only the weak activity: %s", f.Message)
	}
	if !strings.Contains(f.Recommendation, "Verbo fuerte + Sustantivo + Complemento") {
		t.Fatalf("recommendation must cite DNP structure: %s", f.Recommendation)
	}
}

func TestAuditDnpVerbs_AccentInsensitive(t *testing.T) {
	res := auditWith(t, activitiesEdt("GARANTIZAR la cobertura", "Disenar el material publicitario"), dnpDict())
	if findFinding(res, "warn-activity-weak-verb") == nil {
		t.Fatal("expected weak verb finding for upper-case verb")
	}
	if findFinding(res, "warn-activity-infinitive") != nil {
		t.Fatal("'Disenar' (no accent) must match strong verb 'Diseñar'")
	}
}

func TestAuditDnpVerbs_StrongVerbsPass(t *testing.T) {
	res := auditWith(t, activitiesEdt("Elaborar el plan de menús", "Diseñar el material publicitario"), dnpDict())
	if f := findFinding(res, "warn-activity-weak-verb"); f != nil {
		t.Fatalf("unexpected weak verb finding: %+v", f)
	}
	if f := findFinding(res, "warn-activity-infinitive"); f != nil {
		t.Fatalf("unexpected infinitive finding: %+v", f)
	}
}

func TestAuditDnpVerbs_NonInfinitiveFlagged(t *testing.T) {
	res := auditWith(t, activitiesEdt("Diseño del material publicitario", "Elaborar el plan"), dnpDict())
	f := findFinding(res, "warn-activity-infinitive")
	if f == nil || !strings.Contains(f.Message, "Diseño del material") {
		t.Fatalf("expected infinitive finding for noun-led activity, got %+v", f)
	}
}

func TestAuditDnpVerbs_NoReaderOrErrorSkipsCheck(t *testing.T) {
	for name, reader := range map[string]appproject.DnpVerbReader{
		"nil":   nil,
		"error": &mockDnpVerbReader{err: errors.New("db down")},
		"empty": &mockDnpVerbReader{},
	} {
		res := auditWith(t, activitiesEdt("Fortalecer capacidades", "Diseño del material"), reader)
		if findFinding(res, "warn-activity-weak-verb") != nil || findFinding(res, "warn-activity-infinitive") != nil {
			t.Fatalf("%s: verb checks must be skipped without a dictionary", name)
		}
	}
}
