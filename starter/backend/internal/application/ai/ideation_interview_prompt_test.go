package ai

import (
	"strings"
	"testing"
)

func TestBuildIdeationInterviewSystemPrompt_ContainsDecreto1278Rules(t *testing.T) {
	prompt := BuildIdeationInterviewSystemPrompt("", 1)

	expectedSections := []string{
		"### REGLAS DE AUDITORÍA Y ANEXOS LOCALES (DECRETO 1278 VALLE DEL CAUCA) ###",
		"1. PROYECTOS TECNOLÓGICOS / TIC:",
		"Concepto Técnico favorable de la Secretaría de las Tecnologías de la Información y las Comunicaciones (TIC)",
		"2. COMUNIDADES ÉTNICAS:",
		"Certificado de alineación con el respectivo Plan de Etnodesarrollo o Plan de Vida de la comunidad",
		"3. INFRAESTRUCTURA FÍSICA:",
		"Estudios y diseños técnicos actualizados y aprobados",
		"Certificado de titularidad del predio",
	}

	for _, expected := range expectedSections {
		if !strings.Contains(prompt, expected) {
			t.Errorf("prompt does not contain expected text: %q", expected)
		}
	}
}

func TestBuildIdeationInterviewSystemPrompt_FaseMaduracion(t *testing.T) {
	// Test Default / Perfil
	promptDefault := BuildIdeationInterviewSystemPrompt("", 1)
	if !strings.Contains(promptDefault, "Fase actual indicada: Perfil") {
		t.Errorf("expected default phase Perfil, got prompt: %s", promptDefault)
	}
	if !strings.Contains(promptDefault, `Si el proyecto está en fase de "Perfil", permite estimaciones presupuestales aproximadas.`) {
		t.Errorf("expected Perfil rule in prompt")
	}
	if !strings.Contains(promptDefault, `Si está en fase de "Factibilidad", exige rigor absoluto, mencionando que se requieren diseños y presupuestos de obra detallados ítem por ítem en la cadena de valor.`) {
		t.Errorf("expected Factibilidad rule in prompt")
	}

	// Test Explicit Factibilidad
	promptFact := BuildIdeationInterviewSystemPrompt("", 1, "Factibilidad")
	if !strings.Contains(promptFact, "Fase actual indicada: Factibilidad") {
		t.Errorf("expected phase Factibilidad, got: %s", promptFact)
	}

	// Test Explicit Prefactibilidad
	promptPre := BuildIdeationInterviewSystemPrompt("", 1, "Prefactibilidad")
	if !strings.Contains(promptPre, "Fase actual indicada: Prefactibilidad") {
		t.Errorf("expected phase Prefactibilidad, got: %s", promptPre)
	}
}

func TestBuildIdeationInterviewSystemPrompt_TurnHandling(t *testing.T) {
	// Intermediate turn
	promptTurn2 := BuildIdeationInterviewSystemPrompt("", 2)
	if !strings.Contains(promptTurn2, "Turno actual: 2 de 4") {
		t.Errorf("expected intermediate turn notification, got: %s", promptTurn2)
	}

	// Final turn
	promptFinalTurn := BuildIdeationInterviewSystemPrompt("", MaxIdeationTurns)
	if !strings.Contains(promptFinalTurn, "INSTRUCCIÓN FINAL OBLIGATORIA") {
		t.Errorf("expected final turn instruction, got: %s", promptFinalTurn)
	}
	if !strings.Contains(promptFinalTurn, ContextCompleteKeyword) {
		t.Errorf("expected [CONTEXTO_COMPLETO] keyword in final turn")
	}
}

func TestBuildIdeationInterviewSystemPrompt_WithRAG(t *testing.T) {
	rag := "1) [project] Proyecto histórico: Conectividad rural en Dagua"
	prompt := BuildIdeationInterviewSystemPrompt(rag, 1)

	if !strings.Contains(prompt, "CONTEXTO DE PROYECTOS SIMILARES (Knowledge Graph)") {
		t.Errorf("expected RAG section header in prompt")
	}
	if !strings.Contains(prompt, rag) {
		t.Errorf("expected RAG content in prompt")
	}
}

func TestIsIdeationInterviewRoute(t *testing.T) {
	if !IsIdeationInterviewRoute(RouteContextIdeationInterview) {
		t.Errorf("expected %s to be recognized as ideation route", RouteContextIdeationInterview)
	}
	if IsIdeationInterviewRoute("mga:other-route") {
		t.Errorf("expected mga:other-route to not be recognized")
	}
}

func TestIsContextCompleteAndClean(t *testing.T) {
	replyWithKey := "[CONTEXTO_COMPLETO] ¡Excelente! Recuerda gestionar el concepto TIC antes de radicar."
	if !IsContextComplete(replyWithKey) {
		t.Errorf("expected IsContextComplete to return true")
	}

	cleaned := CleanContextCompleteKeyword(replyWithKey)
	if strings.Contains(cleaned, ContextCompleteKeyword) {
		t.Errorf("expected keyword to be removed from cleaned reply")
	}
	if !strings.Contains(cleaned, "concepto TIC") {
		t.Errorf("expected remaining message to be preserved, got: %q", cleaned)
	}

	onlyKey := "[CONTEXTO_COMPLETO]"
	cleanedDefault := CleanContextCompleteKeyword(onlyKey)
	if cleanedDefault != IdeationCompleteDefaultReply {
		t.Errorf("expected default reply %q, got %q", IdeationCompleteDefaultReply, cleanedDefault)
	}
}
