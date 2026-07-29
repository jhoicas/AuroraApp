package postgres

import (
	"strings"
	"testing"
)

func TestParseEdtFromCSV_PreservesLeadingZeros(t *testing.T) {
	csv := "" +
		"Código producto estandarizado,Nombre Producto,Codigo entregable nivel 1,Nombre entregable nivel 1,Codigo entregable nivel 2,Nombre entregable nivel 2,Codigo entregable nivel 3,Nombre entregable nivel 3,Codigo actividad,Actividad,Unidad de medida\n" +
		"0406016,Producto Demo,01,Ent L1,0101,Ent L2,010101,Ent L3,00012,Actividad demo,Número\n" +
		"'0302001,Otro Producto,02,E1,0202,E2,020203,E3,00001,Otra act,Unidad\n"

	result, err := ParseEdtFromCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("ParseEdtFromCSV: %v", err)
	}
	if len(result.Rows) != 2 {
		t.Fatalf("want 2 rows, got %d (errors=%v)", len(result.Rows), result.Errors)
	}

	r0 := result.Rows[0]
	if r0.CodigoProductoEstandarizado != "0406016" {
		t.Errorf("codigo producto: got %q want %q", r0.CodigoProductoEstandarizado, "0406016")
	}
	if r0.CodigoActividad != "00012" {
		t.Errorf("codigo actividad: got %q want %q", r0.CodigoActividad, "00012")
	}
	if r0.CodigoEntregableL1 != "01" {
		t.Errorf("codigo entregable L1: got %q want %q", r0.CodigoEntregableL1, "01")
	}

	r1 := result.Rows[1]
	if r1.CodigoProductoEstandarizado != "0302001" {
		t.Errorf("codigo producto con apóstrofe: got %q want %q", r1.CodigoProductoEstandarizado, "0302001")
	}
}

func TestEdtPreserveCode_NoNumericConversion(t *testing.T) {
	row := []string{"0406016", "x", "01", "a", "02", "b", "03", "c", "00012", "act", "u"}
	if got := edtPreserveCode(row, 0); got != "0406016" {
		t.Errorf("got %q", got)
	}
	if got := edtPreserveCode([]string{"406016.0"}, 0); got != "406016" {
		t.Errorf("strip .0: got %q", got)
	}
	// No debe reinterpretar ni quitar ceros de un código textual.
	if got := edtPreserveCode([]string{"0406016.0"}, 0); got != "0406016" {
		t.Errorf("keep zeros with .0: got %q", got)
	}
}
