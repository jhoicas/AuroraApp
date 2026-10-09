package handlers

import (
	"fmt"
	"strings"
)

// isRiesgoField indica si el campo pertenece a la sección de Riesgos (Preparación).
func isRiesgoField(fieldKey string) bool {
	return strings.HasPrefix(strings.ToLower(fieldKey), "riesgo_")
}

// buildRiesgoRule arma la directiva del prompt para campos de Riesgos según el
// nivel de clasificación (1-Propósito, 2-Componente, 3-Actividad) y el ítem asociado.
func buildRiesgoRule(fieldKey string, ctx map[string]any) string {
	if !isRiesgoField(fieldKey) {
		return ""
	}
	str := func(k string) string {
		v, _ := ctx[k].(string)
		return strings.TrimSpace(v)
	}
	nivel := str("nivel_clasificacion")
	item := str("item_asociado")

	var directive string
	switch {
	case strings.HasPrefix(nivel, "1"):
		directive = "NIVEL 1-Propósito (Objetivo general): genera riesgos macro, estratégicos o de impacto a largo plazo que amenacen el fin último del proyecto."
	case strings.HasPrefix(nivel, "2"):
		directive = "NIVEL 2-Componente (Productos): genera riesgos de mercado, calidad, entrega, tecnológicos o de adopción específicos para ese bien o servicio."
	case strings.HasPrefix(nivel, "3"):
		directive = "NIVEL 3-Actividad o Entregable: genera riesgos operativos, logísticos, administrativos, climáticos o de ejecución específicos para esa tarea puntual."
	}

	var b strings.Builder
	if directive != "" {
		b.WriteString("\n" + directive)
	}
	if item != "" {
		b.WriteString(fmt.Sprintf("\nÍTEM ASOCIADO AL RIESGO (texto exacto): %q", item))
	}
	if tipo := str("tipo"); tipo != "" {
		b.WriteString(fmt.Sprintf("\nTIPO DE RIESGO: %s", tipo))
	}
	if r := str("riesgo"); r != "" && fieldKey != "riesgo_descripcion" {
		b.WriteString(fmt.Sprintf("\nDESCRIPCIÓN DEL RIESGO: %s", r))
	}
	b.WriteString("\nGenera un riesgo único y altamente específico para este ítem. NO repitas riesgos genéricos de retrasos o sobrecostos a menos que sea estrictamente el riesgo principal. Asegura congruencia total con el alcance e impacto del proyecto.")
	return b.String()
}
