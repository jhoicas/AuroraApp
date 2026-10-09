package postgres

import "testing"

func TestParseProducedGoodsSeed(t *testing.T) {
	goods, err := parseProducedGoodsSeed(producedGoodsSeedJSON)
	if err != nil {
		t.Fatal(err)
	}
	if len(goods) < 300 {
		t.Fatalf("expected full seed list, got %d", len(goods))
	}
	for _, g := range goods {
		if g.Description == "" || g.Rpc < 0 {
			t.Fatalf("invalid seed row: %+v", g)
		}
	}
}
