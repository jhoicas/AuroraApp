package ai

import (
	"strings"
	"testing"
)

func TestIsMgaCausesEffectsRoute(t *testing.T) {
	if !IsMgaCausesEffectsRoute(RouteContextMgaCausesEffects) {
		t.Fatal("expected mga route match")
	}
	if IsMgaCausesEffectsRoute("/admin/catalogs/ods") {
		t.Fatal("unexpected match")
	}
}

func TestBuildMgaCausesEffectsRAGQuery(t *testing.T) {
	q := BuildMgaCausesEffectsRAGQuery("problema", "situacion", "magnitud", "mensaje")
	for _, part := range []string{"problema", "situacion", "magnitud", "mensaje"} {
		if !strings.Contains(q, part) {
			t.Fatalf("missing %q in %q", part, q)
		}
	}
}

func TestBuildMgaCausesEffectsSystemPrompt_ContainsStrictRule(t *testing.T) {
	prompt := BuildMgaCausesEffectsSystemPrompt("1) [cause] Causa: texto")
	if !strings.Contains(prompt, "REGLA ABSOLUTA") {
		t.Fatal("missing strict rule")
	}
	if !strings.Contains(prompt, MgaCausesEffectsEmptyRAGMessage) {
		t.Fatal("missing empty RAG message")
	}
	if !strings.Contains(prompt, "Causa: texto") {
		t.Fatal("missing RAG content")
	}
}
