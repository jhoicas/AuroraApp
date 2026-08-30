package models

import "testing"

func TestEdtCompositeKey_FiveColumns(t *testing.T) {
	key := EdtCompositeKey("0406016", "01", "0101", "010101", "00012")
	other := EdtCompositeKey("0406016", "01", "0101", "010101", "00013")
	if key == other {
		t.Fatal("distinct activity codes must produce distinct keys")
	}
	same := EdtCompositeKey("0406016", "01", "0101", "010101", "00012")
	if key != same {
		t.Fatalf("expected same key, got %q vs %q", same, key)
	}
	emptyEnt := EdtCompositeKey("P1", "", "", "", "A1")
	if emptyEnt == EdtCompositeKey("P1", "01", "", "", "A1") {
		t.Fatal("empty entregable codes must differ from non-empty L1")
	}
}
