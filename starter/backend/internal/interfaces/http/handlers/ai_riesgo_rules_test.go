package handlers

import (
	"strings"
	"testing"
)

func TestBuildRiesgoRule(t *testing.T) {
	cases := map[string]string{
		"1-Propósito (Objetivo general)": "macro, estratégicos",
		"2-Componente (Productos)":       "mercado, calidad, entrega",
		"3-Actividad o Entregable":       "operativos, logísticos",
	}
	for nivel, want := range cases {
		got := buildRiesgoRule("riesgo_descripcion", map[string]any{"nivel_clasificacion": nivel, "item_asociado": "Item X"})
		if !strings.Contains(got, want) || !strings.Contains(got, "Item X") || !strings.Contains(got, "único y altamente específico") {
			t.Errorf("nivel %q: regla incompleta: %s", nivel, got)
		}
	}
	if buildRiesgoRule("causas", map[string]any{"nivel_clasificacion": "1-X"}) != "" {
		t.Error("campo no-riesgo debe devolver vacío")
	}
}
