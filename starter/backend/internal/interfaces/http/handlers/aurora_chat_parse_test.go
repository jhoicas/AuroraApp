package handlers

import "testing"

func TestParseAuroraResponseWithActionCards(t *testing.T) {
	raw := "Te recomiendo el ODS 1.1.\n\n```aurora-actions\n{\"action_cards\":[{\"catalog\":\"ods\",\"code\":\"1.1\",\"label\":\"Fin de la pobreza\"}]}\n```"

	reply, cards := parseAuroraResponse(raw)
	if len(cards) != 1 {
		t.Fatalf("expected 1 card, got %d", len(cards))
	}
	if cards[0].Code != "1.1" || cards[0].Catalog != "ods" {
		t.Fatalf("unexpected card: %+v", cards[0])
	}
	if reply == "" || reply == raw {
		t.Fatalf("reply should strip action block, got %q", reply)
	}
}

func TestDescribeRouteOds(t *testing.T) {
	got := describeRoute("/admin/catalogs/ods")
	if got == "" {
		t.Fatal("expected route description")
	}
}
