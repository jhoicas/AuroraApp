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

func TestApplyLengthRule(t *testing.T) {
	for _, key := range []string{"riesgo_descripcion", "riesgo_efectos", "riesgo_medidas", "RIESGO_probabilidad"} {
		got := applyLengthRule(key, "Regla base.")
		if strings.Contains(got, "10 a 15 palabras") {
			t.Errorf("%s no debe llevar el límite corto: %s", key, got)
		}
		if !strings.Contains(got, "máximo 30 a 40 palabras") || !strings.HasPrefix(got, "Regla base.") {
			t.Errorf("%s debe llevar la regla amplia: %s", key, got)
		}
	}
	for _, key := range []string{"objetivo_general", "actividad", "problema_central", "causas"} {
		got := applyLengthRule(key, "Regla base.")
		if !strings.Contains(got, "máximo 10 a 15 palabras") || strings.Contains(got, "30 a 40") {
			t.Errorf("%s conserva el límite corto: %s", key, got)
		}
	}
	for _, key := range []string{"intereses_participante", "contribucion_participante"} {
		if got := applyLengthRule(key, "Regla base."); got != conciseRule {
			t.Errorf("%s debe usar solo la regla concisa: %s", key, got)
		}
	}
	// Un campo que solo contiene "riesgo" dentro del nombre no es de la sección Riesgos.
	if got := applyLengthRule("mitigacion_riesgo", "R."); !strings.Contains(got, "10 a 15") {
		t.Errorf("solo el prefijo riesgo_ exceptúa: %s", got)
	}
}
