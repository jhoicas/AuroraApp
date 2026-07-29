package postgres

import (
	"strings"
	"testing"
)

func TestParseActivitiesFromCSV_PreservesLeadingZeros(t *testing.T) {
	csv := "" +
		"Listado de actividades,Unidad de medida,Código actividad\n" +
		"Realizar suministro e instalación de cielo raso,Metros cuadrados,000000003\n" +
		"'Instalar enchape,Metros cuadrados,000000012\n"

	result, err := ParseActivitiesFromCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("ParseActivitiesFromCSV: %v", err)
	}
	if len(result.Rows) != 2 {
		t.Fatalf("want 2 rows, got %d (errors=%v)", len(result.Rows), result.Errors)
	}
	if result.Rows[0].CodigoActividad != "000000003" {
		t.Errorf("codigo: got %q want %q", result.Rows[0].CodigoActividad, "000000003")
	}
	if result.Rows[0].UnidadDeMedida != "Metros cuadrados" {
		t.Errorf("unidad: got %q", result.Rows[0].UnidadDeMedida)
	}
	if result.Rows[1].CodigoActividad != "000000012" {
		t.Errorf("codigo con apóstrofe: got %q", result.Rows[1].CodigoActividad)
	}
}

func TestParseActivities_CodigoFirstHeader(t *testing.T) {
	csv := "Código actividad,Listado de actividades,Unidad de medida\n000000001,Actividad demo,Número\n"
	result, err := ParseActivitiesFromCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(result.Rows) != 1 {
		t.Fatalf("want 1 row, got %d", len(result.Rows))
	}
	if result.Rows[0].CodigoActividad != "000000001" {
		t.Errorf("got %q", result.Rows[0].CodigoActividad)
	}
	if result.Rows[0].ListadoDeActividades != "Actividad demo" {
		t.Errorf("listado: got %q", result.Rows[0].ListadoDeActividades)
	}
}
