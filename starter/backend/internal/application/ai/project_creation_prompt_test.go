package ai

import (
	"strings"
	"testing"
)

func TestIsMgaProjectCreationRoute(t *testing.T) {
	if !IsMgaProjectCreationRoute(RouteContextMgaProjectCreation) {
		t.Fatal("expected project creation route match")
	}
	if IsMgaProjectCreationRoute("mga:identificacion:causas-efectos") {
		t.Fatal("unexpected match")
	}
}

func TestBuildProjectCreationRAGQuery(t *testing.T) {
	q := BuildProjectCreationRAGQuery(
		"Acueducto rural",
		"S01",
		"Agua potable",
		[]string{"P1", "P2"},
		[]string{"PR1"},
		[]string{"6.1"},
		"Quiero crear un proyecto",
	)
	for _, part := range []string{"Acueducto rural", "S01", "Agua potable", "P1", "P2", "PR1", "6.1", "Quiero crear un proyecto"} {
		if !strings.Contains(q, part) {
			t.Fatalf("missing %q in %q", part, q)
		}
	}
}

func TestBuildProjectCreationSystemPrompt_WithRAG(t *testing.T) {
	prompt := BuildProjectCreationSystemPrompt("1) [project] Proyecto histórico: texto", "- Sector: Agua")
	if !strings.Contains(prompt, "GUÍA CON KNOWLEDGE GRAPH") {
		t.Fatal("missing KG block")
	}
	if !strings.Contains(prompt, "Proyecto histórico") {
		t.Fatal("missing RAG content")
	}
	if strings.Contains(prompt, ProjectCreationDegradedRAGNote) {
		t.Fatal("degraded note should not appear when RAG is present")
	}
	if !strings.Contains(prompt, "mga_generate_project") {
		t.Fatal("missing action card type")
	}
}

func TestBuildProjectCreationSystemPrompt_DegradedMode(t *testing.T) {
	prompt := BuildProjectCreationSystemPrompt("", "")
	if !strings.Contains(prompt, "MODO DEGRADADO") {
		t.Fatal("missing degraded mode header")
	}
	if !strings.Contains(prompt, ProjectCreationDegradedRAGNote) {
		t.Fatal("missing degraded note")
	}
	if strings.Contains(prompt, "Contexto del Knowledge Graph") {
		t.Fatal("KG block should not appear in degraded mode")
	}
	if !strings.Contains(prompt, "1-2 preguntas") {
		t.Fatal("missing interview rules")
	}
}

func TestFormatCreationCatalogSummary(t *testing.T) {
	summary := FormatCreationCatalogSummary("Idea", "S01", "Agua", []string{"P1"}, []string{"PR1"}, []string{"6.1"})
	for _, part := range []string{"Idea inicial", "Sector: Agua", "Productos: P1", "Programas: PR1", "ODS: 6.1"} {
		if !strings.Contains(summary, part) {
			t.Fatalf("missing %q in %q", part, summary)
		}
	}
}
