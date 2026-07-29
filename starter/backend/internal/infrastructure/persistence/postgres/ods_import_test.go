package postgres

import (
	"strings"
	"testing"
)

func TestParseOdsFromCSV_PreservesCodes(t *testing.T) {
	csv := "" +
		"Cod. Objetivo ODS,Descripción Objetivo ODS,Código Meta ODS,Descripción Meta ODS\n" +
		"1,Fin de la pobreza,1.1,Erradicar la pobreza extrema\n" +
		"1,Fin de la pobreza,1.10,Meta adicional\n" +
		"01,Objetivo con cero,1.a,Cooperación\n"

	result, err := ParseOdsFromCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("ParseOdsFromCSV: %v", err)
	}
	if len(result.Rows) != 3 {
		t.Fatalf("want 3 rows, got %d (errors=%v)", len(result.Rows), result.Errors)
	}
	if result.Rows[0].CodigoMetaOds != "1.1" {
		t.Errorf("meta 1.1: got %q", result.Rows[0].CodigoMetaOds)
	}
	if result.Rows[1].CodigoMetaOds != "1.10" {
		t.Errorf("meta 1.10 must stay distinct: got %q", result.Rows[1].CodigoMetaOds)
	}
	if result.Rows[2].CodObjetivoOds != "01" {
		t.Errorf("cod objetivo con cero: got %q", result.Rows[2].CodObjetivoOds)
	}
	if result.Rows[2].CodigoMetaOds != "1.a" {
		t.Errorf("meta 1.a: got %q", result.Rows[2].CodigoMetaOds)
	}
}

func TestParseOds_DoesNotCollapseOnePointTen(t *testing.T) {
	row := []string{"1", "Obj", "1.10", "Meta"}
	if got := odsPreserveCode(row, 2); got != "1.10" {
		t.Errorf("got %q want 1.10", got)
	}
}
