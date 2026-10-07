package project

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"unicode"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
)

// Estados globales del dictamen de auditoría.
const (
	AuditStatusApproved     = "APROBADO"
	AuditStatusObservations = "CON_OBSERVACIONES"
	AuditStatusRemediation  = "REQUIERE_SUBSANACION"
)

// Niveles de severidad del dictamen (campo `level` de cada hallazgo).
const (
	AuditLevelError      = "error"
	AuditLevelWarning    = "warning"
	AuditLevelSuggestion = "suggestion"
	AuditLevelOK         = "ok"
)

// Severidad interna adicional a CRITICAL/WARNING/SUCCESS: observaciones de redacción.
const severitySuggestion = "SUGGESTION"

var auditSectionLabels = map[string]string{
	"identificacion":      "Problemática",
	"participantes":       "Participantes",
	"poblacion":           "Población",
	"objetivos":           "Objetivos",
	"alternativas":        "Alternativas",
	"localizacion":        "Localización",
	"plan-desarrollo":     "Plan de Desarrollo",
	"necesidades":         "Necesidades",
	"analisis-tecnico":    "Análisis Técnico",
	"riesgos":             "Riesgos",
	"cadena-valor":        "Cadena de Valor y Presupuesto",
	"ingresos-beneficios": "Ingresos y Beneficios",
	"evaluacion":          "Evaluación Económica",
}

type auditFindingMeta struct {
	Title          string
	FieldKey       string
	Recommendation string
}

// Metadatos por ID de hallazgo: título, campo exacto a corregir y recomendación.
// Los campos coinciden con los `data-audit-field` / prefijos de id de los formularios.
var auditFindingMetas = map[string]auditFindingMeta{
	"crit-problem-desc":             {"Problema central sin describir", "problema-central", "Redacte el problema central como una situación negativa que afecta a una población concreta."},
	"crit-direct-cause":             {"Árbol de problemas sin causas directas", "causas", "Registre al menos una causa directa que origine el problema central."},
	"crit-direct-effect":            {"Árbol de problemas sin efectos directos", "efectos", "Registre al menos un efecto directo que genere el problema central."},
	"crit-causes":                   {"Sin causas registradas", "causas", "Agregue las causas del problema en el árbol de problemas."},
	"crit-target-population":        {"Población objetivo no caracterizada", "poblacion-objetivo", "Registre y caracterice la población objetivo con cifras y fuente."},
	"crit-localization":             {"Localización sin definir", "localizacion", "Seleccione región, departamento y municipio de intervención."},
	"crit-general-objective":        {"Objetivo general sin definir", "objetivo-general", "Redacte el objetivo general como la solución del problema central, iniciando con verbo en infinitivo."},
	"crit-specific-objectives":      {"Sin objetivos específicos", "objetivos-especificos", "Defina un objetivo específico por cada causa directa del árbol de problemas."},
	"crit-alternatives":             {"Sin alternativas de solución", "alternativas", "Plantee y evalúe al menos una alternativa de solución y selecciónela para preparación."},
	"crit-edt-activities-empty":     {"Cadena de valor sin actividades", "actividades", "Registre productos, entregables y actividades presupuestadas."},
	"crit-edt-activities-zero-cost": {"Actividades sin costo presupuestado", "costos", "Asigne costo unitario y total mayor a cero a cada actividad."},
	"warn-situacion-empty":          {"Situación existente sin describir", "situacion-problema", "Describa antecedentes y estado actual del territorio con información verificable."},
	"warn-situacion-short":          {"Situación existente insuficiente", "situacion-problema", "Amplíe la descripción con contexto, antecedentes y fuentes (más de 100 caracteres)."},
	"warn-magnitud-empty":           {"Magnitud del problema sin diligenciar", "magnitud-problema", "Cuantifique el problema con indicadores, línea base y fuente."},
	"warn-magnitud-short":           {"Magnitud del problema insuficiente", "magnitud-problema", "Amplíe con cifras de línea base, año y fuente (más de 100 caracteres)."},
	"warn-horizon":                  {"Horizonte de evaluación sin definir", "horizonte", "Indique el horizonte de evaluación en años."},
	"warn-riesgos-detail":           {"Riesgos incompletos", "riesgos", "Complete nivel de clasificación y medida de mitigación de cada riesgo."},
	"warn-evaluacion-rate":          {"Tasa de oportunidad sin registrar", "tasa-descuento", "Registre la tasa de interés de oportunidad / descuento."},
	"warn-objectives-causes":        {"Objetivos no cubren todas las causas directas", "objetivos-especificos", "Cada causa directa debe tener un objetivo específico que la invierta."},
	"warn-problem-objective-same":   {"Objetivo general repite el problema", "objetivo-general", "Reformule el objetivo como situación deseada, no como copia del problema."},
	"warn-placeholder-text":         {"Texto por defecto o incompleto", "problema-central", "Reemplace textos como 'N/A', 'pendiente' o 'por definir' por información real."},
	"warn-plan-desarrollo":          {"Sin articulación con planes de desarrollo", "plan-desarrollo", "Articule el proyecto con el plan municipal, departamental y el PND."},
	"warn-product-code":             {"Producto del catálogo sin seleccionar", "producto", "Vincule el proyecto a un producto MGA para formular el indicador de producto."},
	"warn-activity-name":            {"Actividades sin nombre", "actividades", "Nombre cada actividad de forma clara."},
	"warn-activity-quantity":        {"Actividades sin cantidad", "cantidades", "Indique la cantidad de cada actividad con costo asignado."},
	"warn-activity-total-mismatch":  {"Costo total no coincide con cantidad × costo unitario", "costos", "Corrija el costo total o el costo unitario/cantidad."},
	"sugg-problem-short":            {"Problema central muy breve", "problema-central", "Precise quién, qué y dónde: problema central sin sustento suficiente."},
	"sugg-magnitud-quant":           {"Magnitud sin cifras", "magnitud-problema", "Incluya valores numéricos (porcentajes, tasas, número de personas) y su fuente."},
	"sugg-objective-verb":           {"Objetivo general sin verbo en infinitivo", "objetivo-general", "Inicie el objetivo con un verbo en infinitivo (p. ej. Mejorar, Construir)."},
}

var auditPlaceholders = []string{"n/a", "por definir", "pendiente", "lorem ipsum", "sin informacion", "sin información", "tbd", "xxx", "test", "prueba"}

func levelForSeverity(sev string) string {
	switch sev {
	case "CRITICAL":
		return AuditLevelError
	case "WARNING":
		return AuditLevelWarning
	case severitySuggestion:
		return AuditLevelSuggestion
	default:
		return AuditLevelOK
	}
}

func defaultRecommendation(sev string) string {
	switch sev {
	case "CRITICAL":
		return "Corrija este elemento antes de radicar el proyecto."
	case "WARNING":
		return "Revise y fortalezca este elemento para evitar observaciones."
	default:
		return ""
	}
}

// enrichFinding completa los campos de navegación y redacción del hallazgo.
func enrichFinding(f AuditFinding, projectID uuid.UUID) AuditFinding {
	meta, ok := auditFindingMetas[f.ID]
	section := auditSectionLabels[f.SectionKey]
	if section == "" {
		section = f.SectionKey
	}
	f.Section = section
	f.TabID = f.SectionKey
	f.Level = levelForSeverity(f.Severity)
	f.Description = f.Message
	if ok {
		f.Title = meta.Title
		f.FieldKey = meta.FieldKey
		f.Recommendation = meta.Recommendation
	} else {
		f.Title = f.Message
		f.Recommendation = defaultRecommendation(f.Severity)
	}
	if f.Severity == "SUCCESS" {
		f.Title = f.Message
		f.Recommendation = ""
		return f
	}
	f.TargetURL = fmt.Sprintf("/tenant/projects/%s?tab=%s", projectID, f.TabID)
	if f.FieldKey != "" {
		f.TargetURL += "&focus=" + f.FieldKey
	}
	return f
}

// scoreAudit calcula puntaje 0-100 y estado global.
func scoreAudit(findings []AuditFinding) (int, string) {
	score := 100
	errors := 0
	for _, f := range findings {
		switch f.Severity {
		case "CRITICAL":
			score -= 15
			errors++
		case "WARNING":
			score -= 6
		case severitySuggestion:
			score -= 2
		}
	}
	if score < 0 {
		score = 0
	}
	switch {
	case errors > 0 || score < 60:
		return score, AuditStatusRemediation
	case score < 100:
		return score, AuditStatusObservations
	default:
		return score, AuditStatusApproved
	}
}

func containsPlaceholder(text string) bool {
	t := strings.ToLower(strings.TrimSpace(text))
	if t == "" {
		return false
	}
	for _, p := range auditPlaceholders {
		if t == p || strings.HasPrefix(t, p+" ") || strings.HasPrefix(t, p+".") {
			return true
		}
	}
	return false
}

func hasDigit(s string) bool {
	for _, r := range s {
		if unicode.IsDigit(r) {
			return true
		}
	}
	return false
}

func normalizeAuditText(s string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimRight(strings.TrimSpace(s), "."))), " ")
}

func startsWithInfinitive(s string) bool {
	fields := strings.Fields(strings.ToLower(strings.TrimSpace(s)))
	if len(fields) == 0 {
		return false
	}
	w := strings.TrimFunc(fields[0], func(r rune) bool { return !unicode.IsLetter(r) })
	return len(w) > 3 && (strings.HasSuffix(w, "ar") || strings.HasSuffix(w, "er") || strings.HasSuffix(w, "ir") || strings.HasSuffix(w, "ír"))
}

func hasPlanDesarrollo(data []byte) bool {
	if len(data) == 0 {
		return false
	}
	var root map[string]json.RawMessage
	if err := json.Unmarshal(data, &root); err != nil {
		return false
	}
	for _, key := range []string{"planDesarrollo", "plan_desarrollo"} {
		raw, ok := root[key]
		if !ok {
			continue
		}
		var obj map[string]interface{}
		if err := json.Unmarshal(raw, &obj); err == nil && len(obj) > 0 {
			return true
		}
	}
	return false
}

func activityIssues(acts []models.ProjectActivity) (noName, noQty, mismatch bool) {
	for _, a := range acts {
		if strings.TrimSpace(a.Name) == "" {
			noName = true
		}
		if a.TotalCost > 0 && a.Quantity <= 0 {
			noQty = true
		}
		if a.Quantity > 0 && a.UnitCost > 0 && a.TotalCost > 0 {
			expected := a.Quantity * a.UnitCost
			if math.Abs(expected-a.TotalCost) > math.Max(1, expected*0.01) {
				mismatch = true
			}
		}
	}
	return
}
