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
