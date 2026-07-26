package handlers

import "testing"

func TestDetectCatalogTarget(t *testing.T) {
	tests := []struct {
		name      string
		sheetName string
		headers   []string
		want      string
	}{
		{name: "sector sheet", sheetName: "Sectores", headers: []string{"codigo", "nombre"}, want: "sectores"},
		{name: "programa sheet", sheetName: "Programas", headers: []string{"codigo_programa", "nombre_programa"}, want: "programas_subprogramas"},
		{name: "producto sheet", sheetName: "Productos", headers: []string{"codigo_producto", "producto"}, want: "catalogo_productos"},
		{name: "edt sheet", sheetName: "EDT", headers: []string{"codigo_producto_estandarizado", "codigo_entregable_l1"}, want: "catalogo_edt"},
		{name: "ods sheet", sheetName: "ODS", headers: []string{"codigo_meta_ods", "descripcion_meta_ods"}, want: "ods"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := detectCatalogTarget(tt.sheetName, tt.headers); got != tt.want {
				t.Fatalf("detectCatalogTarget(%q, %v) = %q, want %q", tt.sheetName, tt.headers, got, tt.want)
			}
		})
	}
}
