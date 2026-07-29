package postgres

import (
	"strings"
	"testing"
)

func TestParseDeliverablesFromCSV_PreservesLeadingZeros(t *testing.T) {
	csv := "" +
		"Listado de Entregables,Código entregable\n" +
		"Infraestructura en obra blanca,000000004\n" +
		"'Pisos y contrapisos,000000012\n"

	result, err := ParseDeliverablesFromCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("ParseDeliverablesFromCSV: %v", err)
	}
	if len(result.Rows) != 2 {
		t.Fatalf("want 2 rows, got %d (errors=%v)", len(result.Rows), result.Errors)
	}
	if result.Rows[0].CodigoEntregable != "000000004" {
		t.Errorf("codigo: got %q want %q", result.Rows[0].CodigoEntregable, "000000004")
	}
	if result.Rows[0].ListadoDeEntregables != "Infraestructura en obra blanca" {
		t.Errorf("listado: got %q", result.Rows[0].ListadoDeEntregables)
	}
	if result.Rows[1].CodigoEntregable != "000000012" {
		t.Errorf("codigo con apóstrofe: got %q", result.Rows[1].CodigoEntregable)
	}
}

func TestParseDeliverables_CodigoFirstHeader(t *testing.T) {
	csv := "Código entregable,Listado de Entregables\n000000001,Entregable demo\n"
	result, err := ParseDeliverablesFromCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("want 1 row, got %d", len(result.Rows))
	}
	if result.Rows[0].CodigoEntregable != "000000001" {
		t.Errorf("got %q", result.Rows[0].CodigoEntregable)
	}
}
