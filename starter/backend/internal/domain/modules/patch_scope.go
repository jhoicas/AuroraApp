package modules

import (
	"bytes"
	"encoding/json"
	"sort"
)

// Requirement es un permiso que una operación necesita.
type Requirement struct {
	Module string
	Action Action
}

// formulationKeyModule asigna cada clave de mga_formulation_data a la etapa MGA (D6) que la edita.
var formulationKeyModule = map[string]string{
	// Identificación
	"planDesarrollo": CodeMGAIdentificacion, "identificacion": CodeMGAIdentificacion,
	"causeRelations": CodeMGAIdentificacion, "generalIndicators": CodeMGAIdentificacion,
	"effects": CodeMGAIdentificacion, "participants": CodeMGAIdentificacion,
	"populations": CodeMGAIdentificacion, "alternatives": CodeMGAIdentificacion,
	"alternativas": CodeMGAIdentificacion, "situation": CodeMGAIdentificacion,
	"magnitude": CodeMGAIdentificacion, "situacion_existente": CodeMGAIdentificacion,
	"magnitud_problema": CodeMGAIdentificacion,
	// Preparación
	"preparacion": CodeMGAPreparacion, "necesidades": CodeMGAPreparacion, "estudioNecesidades": CodeMGAPreparacion,
	"analisisTecnico": CodeMGAPreparacion, "localizacion": CodeMGAPreparacion,
	"localizacionPreparacion": CodeMGAPreparacion, "localizaciones": CodeMGAPreparacion,
	"factores_analizados": CodeMGAPreparacion, "localizaciones_factores": CodeMGAPreparacion,
	"cadenaValor": CodeMGAPreparacion, "cadena_valor": CodeMGAPreparacion, "riesgos": CodeMGAPreparacion,
	"ingresosBeneficios": CodeMGAPreparacion, "prestamos": CodeMGAPreparacion, "depreciacion": CodeMGAPreparacion,
	// Evaluación
	"evaluacion": CodeMGAEvaluacion, "flujoEvaluacion": CodeMGAEvaluacion, "indicadoresDecision": CodeMGAEvaluacion,
	// Programación
	"programacion": CodeMGAProgramacion, "indicadoresProducto": CodeMGAProgramacion,
	"regionalizacion": CodeMGAProgramacion, "focalizacion": CodeMGAProgramacion,
	// Presentar
	"estadoProyecto": CodeMGAPresentar, "documentosSoporte": CodeMGAPresentar,
}

// tabModule asigna cada pestaña de completedSections a su etapa.
var tabModule = map[string]string{
	"plan-desarrollo": CodeMGAIdentificacion, "identificacion": CodeMGAIdentificacion, "problematica": CodeMGAIdentificacion,
	"participantes": CodeMGAIdentificacion, "poblacion": CodeMGAIdentificacion, "objetivos": CodeMGAIdentificacion,
	"alternativas": CodeMGAIdentificacion,
	"necesidades":  CodeMGAPreparacion, "analisis-tecnico": CodeMGAPreparacion, "analisisTecnico": CodeMGAPreparacion,
	"localizacion": CodeMGAPreparacion, "localizacionPreparacion": CodeMGAPreparacion, "cadena-valor": CodeMGAPreparacion,
	"riesgos": CodeMGAPreparacion, "ingresos-beneficios": CodeMGAPreparacion, "ingresosBeneficios": CodeMGAPreparacion,
	"prestamos": CodeMGAPreparacion, "depreciacion": CodeMGAPreparacion, "preparacion": CodeMGAPreparacion,
	"flujo-evaluacion": CodeMGAEvaluacion, "indicadores-decision": CodeMGAEvaluacion, "evaluacion": CodeMGAEvaluacion,
	"ver-presupuesto": CodeMGAEvaluacion, "alcance": CodeMGAEvaluacion,
	"indicadores-producto": CodeMGAProgramacion, "regionalizacion": CodeMGAProgramacion,
	"focalizacion": CodeMGAProgramacion, "programacion": CodeMGAProgramacion,
}

// scalarModule asigna las columnas escalares de PATCH /projects/:id.
var scalarModule = map[string]string{
	"name": CodeProjects, "description": CodeProjects, "fase_maduracion": CodeProjects,
	"problem_description": CodeMGAIdentificacion, "general_objective": CodeMGAIdentificacion,
	"situacion_existente": CodeMGAIdentificacion, "magnitud_problema": CodeMGAIdentificacion,
}

// unknownKeyModule se exige ante claves no catalogadas (lo más restrictivo: el módulo padre de la MGA).
const unknownKeyModule = CodeMGA

// ScalarModule devuelve el módulo que gobierna una columna escalar del proyecto.
func ScalarModule(field string) (string, bool) {
	m, ok := scalarModule[field]
	return m, ok
}

// RequirementsForFormulationPatch calcula qué permisos de edición exige un cambio de
// mga_formulation_data. El frontend envía el snapshot COMPLETO en cada guardado, así que
// solo cuentan las claves cuyo valor realmente cambió respecto de lo almacenado
// (ausente y vacío se consideran iguales). completedSections se compara por pestaña.
func RequirementsForFormulationPatch(existing, incoming map[string]any) []Requirement {
	need := map[string]struct{}{}
	for key, newVal := range incoming {
		if key == "completedSections" {
			for tab := range changedSubKeys(existing[key], newVal) {
				mod, ok := tabModule[tab]
				if !ok {
					mod = unknownKeyModule
				}
				need[mod] = struct{}{}
			}
			continue
		}
		if sameValue(normalizeDefault(key, existing[key]), normalizeDefault(key, newVal)) {
			continue
		}
		mod, ok := formulationKeyModule[key]
		if !ok {
			mod = unknownKeyModule
		}
		need[mod] = struct{}{}
	}
	return toRequirements(need)
}

// MergeRequirements une requisitos eliminando duplicados, con orden estable.
func MergeRequirements(groups ...[]Requirement) []Requirement {
	need := map[string]struct{}{}
	for _, g := range groups {
		for _, r := range g {
			need[r.Module] = struct{}{}
		}
	}
	return toRequirements(need)
}

func toRequirements(need map[string]struct{}) []Requirement {
	out := make([]Requirement, 0, len(need))
	for mod := range need {
		out = append(out, Requirement{Module: mod, Action: ActionEdit})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Module < out[j].Module })
	return out
}

func changedSubKeys(oldV, newV any) map[string]struct{} {
	oldM, _ := oldV.(map[string]any)
	newM, _ := newV.(map[string]any)
	changed := map[string]struct{}{}
	for k, v := range newM {
		if !sameValue(oldM[k], v) {
			changed[k] = struct{}{}
		}
	}
	// Una pestaña que ya no viene en el payload no se toca (el handler fusiona claves).
	return changed
}

// normalizeDefault trata el valor por defecto del cliente como "ausente": el store del
// frontend siempre envía estadoProyecto="EN_FORMULACION" aunque nunca se haya guardado.
func normalizeDefault(key string, v any) any {
	if key == "estadoProyecto" && v == "EN_FORMULACION" {
		return nil
	}
	return v
}

// sameValue compara por JSON canónico; nil, "", {}, [] y false equivalen a "ausente".
func sameValue(a, b any) bool {
	if isEmpty(a) && isEmpty(b) {
		return true
	}
	ja, errA := json.Marshal(a)
	jb, errB := json.Marshal(b)
	if errA != nil || errB != nil {
		return false
	}
	return bytes.Equal(ja, jb)
}

func isEmpty(v any) bool {
	switch t := v.(type) {
	case nil:
		return true
	case string:
		return t == ""
	case bool:
		return !t
	case []any:
		return len(t) == 0
	case map[string]any:
		return len(t) == 0
	}
	return false
}
