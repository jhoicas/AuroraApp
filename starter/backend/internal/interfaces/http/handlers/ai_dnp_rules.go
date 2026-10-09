package handlers

import (
	"context"
	"fmt"
	"strings"

	"aurora-backend/internal/domain/models"
)

// DnpDictionaryReader lee los diccionarios DNP dinámicos (verbos y unidades)
// que el SUPER_ADMIN administra; alimentan las reglas del asistente IA.
type DnpDictionaryReader interface {
	ListVerbs(ctx context.Context) ([]models.DnpVerb, error)
	ListUnits(ctx context.Context, onlyActive bool) ([]models.DnpStandardUnit, error)
}

// dnpFieldKind clasifica el campo MGA según la regla DNP que le aplica.
type dnpFieldKind int

const (
	dnpFieldNone dnpFieldKind = iota
	dnpFieldObjective
	dnpFieldActivity
	dnpFieldIndicator
	dnpFieldUnit
)

func classifyDnpField(fieldKey string) dnpFieldKind {
	k := strings.ToLower(fieldKey)
	switch {
	case strings.Contains(k, "unidad"):
		return dnpFieldUnit
	case strings.Contains(k, "indicador") && !strings.Contains(k, "fuente"):
		return dnpFieldIndicator
	case k == "objetivo_general" || k == "general_objective" || k == "objetivos_especificos" ||
		k == "objetivo_especifico" || strings.HasPrefix(k, "specific_objective") || k == "proposito":
		return dnpFieldObjective
	case strings.Contains(k, "actividad") || strings.Contains(k, "cadena_valor") || k == "acciones" || k == "accion":
		return dnpFieldActivity
	}
	return dnpFieldNone
}

// dnpDictionary es la vista en memoria de los diccionarios para construir el prompt.
type dnpDictionary struct {
	Strong []string
	Weak   []string
	Units  []models.DnpStandardUnit
}

func (h *AIHandler) loadDnpDictionary(ctx context.Context) dnpDictionary {
	var d dnpDictionary
	if h.dnp == nil {
		return d
	}
	if verbs, err := h.dnp.ListVerbs(ctx); err == nil {
		for _, v := range verbs {
			if v.Kind == models.DnpVerbKindWeak {
				d.Weak = append(d.Weak, v.Verb)
			} else {
				d.Strong = append(d.Strong, v.Verb)
			}
		}
	}
	if units, err := h.dnp.ListUnits(ctx, true); err == nil {
		d.Units = units
	}
	return d
}

func formatDnpUnits(units []models.DnpStandardUnit) string {
	byTypology := map[string][]string{}
	var order []string
	for _, u := range units {
		if _, ok := byTypology[u.Typology]; !ok {
			order = append(order, u.Typology)
		}
		label := u.Name
		if u.Symbol != "" {
			label += " (" + u.Symbol + ")"
		}
		byTypology[u.Typology] = append(byTypology[u.Typology], label)
	}
	parts := make([]string, 0, len(order))
	for _, t := range order {
		parts = append(parts, fmt.Sprintf("%s: %s", t, strings.Join(byTypology[t], ", ")))
	}
	return strings.Join(parts, "; ")
}

// buildDnpRules devuelve las reglas DNP para el campo, usando SOLO los valores
// del diccionario en base de datos. Si el diccionario está vacío, aplica la
// fórmula sin lista cerrada (nunca recurre a listas embebidas en código).
func buildDnpRules(fieldKey string, d dnpDictionary) string {
	strong := strings.Join(d.Strong, ", ")
	weak := strings.Join(d.Weak, ", ")
	var b strings.Builder

	switch classifyDnpField(fieldKey) {
	case dnpFieldObjective:
		if strong != "" {
			fmt.Fprintf(&b, "REGLA CRÍTICA: Tu respuesta DEBE comenzar obligatoriamente con un verbo en infinitivo de la siguiente lista de VERBOS FUERTES: %s. No utilices ningún otro verbo de inicio.", strong)
		} else {
			b.WriteString("REGLA CRÍTICA: Tu respuesta DEBE comenzar con un verbo rector fuerte en infinitivo.")
		}
		if weak != "" {
			fmt.Fprintf(&b, "\nPROHIBIDO iniciar con verbos débiles: %s.", weak)
		}

	case dnpFieldActivity:
		b.WriteString("REGLA CRÍTICA DNP (Guía de actividades): Redacta la actividad con la fórmula obligatoria VERBO RECTOR FUERTE EN INFINITIVO + SUSTANTIVO DIRECTO (objeto medible de la acción) + COMPLEMENTO DEL SUSTANTIVO (qué, sobre qué, para quién o dónde). Ejemplo: \"Realizar diagnóstico de condiciones de infraestructura educativa en zonas rurales\".")
		if strong != "" {
			fmt.Fprintf(&b, "\nEl verbo inicial DEBE ser uno de esta lista de VERBOS FUERTES: %s. No utilices ningún otro verbo de inicio.", strong)
		}
		if weak != "" {
			fmt.Fprintf(&b, "\nPROHIBIDO usar estos verbos débiles: %s.", weak)
		}
		b.WriteString("\nNo redactes actividades de adquisición de insumos (comprar papelería, adquirir equipos, viáticos, contratar personal) ni uses sustantivos en lugar del verbo (\"Diseño de…\" es incorrecto; \"Diseñar…\" es correcto).")

	case dnpFieldIndicator:
		b.WriteString("REGLA CRÍTICA DNP: El indicador DEBE seguir la fórmula SUSTANTIVO DIRECTO + PARTICIPIO DEL VERBO RECTOR de la actividad (p. ej. \"Diagnósticos realizados\", \"Raciones preparadas\", \"Personas capacitadas\"). Lo que se hace, se mide. No incluyas verbos en infinitivo, metas ni unidades en el nombre del indicador.")
		if strong != "" {
			fmt.Fprintf(&b, "\nEl participio DEBE derivarse de uno de estos verbos fuertes: %s.", strong)
		}

	case dnpFieldUnit:
		if len(d.Units) > 0 {
			fmt.Fprintf(&b, "REGLA CRÍTICA DNP: Responde ÚNICAMENTE con una unidad de medida del listado autorizado: %s. No inventes unidades.", formatDnpUnits(d.Units))
		} else {
			b.WriteString("REGLA CRÍTICA DNP: Responde únicamente con una unidad de medida estándar.")
		}
		b.WriteString("\nNo confundas el objeto medido con la unidad: para elementos discretos (informes, diagnósticos, capacitaciones, raciones, beneficiarios) la unidad es \"Número\", nunca \"Informe\".")
	}
	return b.String()
}
