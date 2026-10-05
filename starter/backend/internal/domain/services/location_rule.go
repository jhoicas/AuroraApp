package services

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// Regla de negocio: localización estricta.
// Un proyecto nace con un Departamento base (la primera localización con departamento
// del momento de creación). En los módulos posteriores de la MGA (Población y Localización)
// solo se permiten localizaciones dentro de ese departamento.

// BaseLocationKey clave reservada dentro de mga_formulation_data donde se fija la
// localización base. El cliente no puede modificarla vía PATCH.
const BaseLocationKey = "localizacion_base"

// BaseLocation localización base del proyecto.
type BaseLocation struct {
	RegionID       *int
	DepartamentoID int
}

// LocationRef referencia geográfica extraída de un payload (departamento y/o municipio).
type LocationRef struct {
	DepartamentoID *int
	MunicipioID    *int
}

func (r LocationRef) key() string {
	return fmt.Sprintf("%s|%s", intPtrKey(r.DepartamentoID), intPtrKey(r.MunicipioID))
}

func intPtrKey(v *int) string {
	if v == nil {
		return ""
	}
	return strconv.Itoa(*v)
}

// ToMap serializa la base para guardarla en mga_formulation_data.
func (b BaseLocation) ToMap() map[string]interface{} {
	m := map[string]interface{}{"departamento_id": b.DepartamentoID}
	if b.RegionID != nil {
		m["region_id"] = *b.RegionID
	}
	return m
}

// ResolveBaseLocation devuelve la base de un proyecto a partir de su mga_formulation_data:
// primero la clave reservada; si no existe (proyectos previos a la regla), la primera
// localización que tenga departamento. nil si el proyecto no tiene ninguna.
func ResolveBaseLocation(data map[string]interface{}) *BaseLocation {
	if data == nil {
		return nil
	}
	if stored, ok := data[BaseLocationKey].(map[string]interface{}); ok {
		if dep := firstInt(stored, "departamento_id", "departamentoId"); dep != nil {
			return &BaseLocation{RegionID: firstInt(stored, "region_id", "regionId"), DepartamentoID: *dep}
		}
	}
	return deriveBaseFromLocalizaciones(data)
}

func deriveBaseFromLocalizaciones(data map[string]interface{}) *BaseLocation {
	candidates := [][]interface{}{asSlice(data["localizaciones"])}
	if iden, ok := data["identificacion"].(map[string]interface{}); ok {
		candidates = append(candidates, asSlice(iden["localizaciones"]))
	}
	if loc, ok := data["localizacion"].(map[string]interface{}); ok {
		candidates = append(candidates, asSlice(loc["localizaciones"]))
	}
	for _, list := range candidates {
		for _, raw := range list {
			item, ok := raw.(map[string]interface{})
			if !ok {
				continue
			}
			if dep := firstInt(item, "departamento_id", "departamentoId"); dep != nil {
				return &BaseLocation{RegionID: firstInt(item, "region_id", "regionId"), DepartamentoID: *dep}
			}
		}
	}
	return nil
}

// ExtractLocationRefs recorre las rutas de mga_formulation_data donde la MGA guarda
// localizaciones posteriores a la creación del proyecto:
//   - localizaciones[]                              (Preparación → Localización)
//   - localizacion.localizaciones[]                 (Preparación → Localización)
//   - localizacionPreparacion.<alt>.ubicaciones[]   (Localización por alternativa)
//   - identificacion.poblacion.{afectada,objetivo}.localizaciones[]  (Identificación → Población)
//
// Acepta claves en snake_case y camelCase. Las filas sin departamento ni municipio se ignoran.
func ExtractLocationRefs(data map[string]interface{}) []LocationRef {
	var refs []LocationRef
	add := func(list interface{}) {
		for _, raw := range asSlice(list) {
			if item, ok := raw.(map[string]interface{}); ok {
				if ref, ok := refFromMap(item); ok {
					refs = append(refs, ref)
				}
			}
		}
	}

	add(data["localizaciones"])
	if loc, ok := data["localizacion"].(map[string]interface{}); ok {
		add(loc["localizaciones"])
	}
	if prep, ok := data["localizacionPreparacion"].(map[string]interface{}); ok {
		for _, alt := range prep {
			if altMap, ok := alt.(map[string]interface{}); ok {
				add(altMap["ubicaciones"])
			}
		}
	}
	if iden, ok := data["identificacion"].(map[string]interface{}); ok {
		if pob, ok := iden["poblacion"].(map[string]interface{}); ok {
			for _, kind := range []string{"afectada", "objetivo"} {
				if detail, ok := pob[kind].(map[string]interface{}); ok {
					add(detail["localizaciones"])
				}
			}
		}
	}
	return refs
}

// ExtractPopulationLocationRefs extrae referencias de la columna locations (JSONB) de
// mga_populations. Soporta un arreglo de ubicaciones, un objeto con "localizaciones"/"locations",
// o un objeto que lleva directamente departamento_id/municipio_id.
func ExtractPopulationLocationRefs(raw json.RawMessage) []LocationRef {
	if len(raw) == 0 {
		return nil
	}
	var decoded interface{}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil
	}

	var refs []LocationRef
	addList := func(list []interface{}) {
		for _, it := range list {
			if item, ok := it.(map[string]interface{}); ok {
				if ref, ok := refFromMap(item); ok {
					refs = append(refs, ref)
				}
			}
		}
	}

	switch v := decoded.(type) {
	case []interface{}:
		addList(v)
	case map[string]interface{}:
		if ref, ok := refFromMap(v); ok {
			refs = append(refs, ref)
		}
		for _, k := range []string{"localizaciones", "locations", "ubicaciones"} {
			addList(asSlice(v[k]))
		}
	}
	return refs
}

// NewLocationRefs devuelve las referencias de `incoming` que no estaban ya en `existing`.
// Permite que un proyecto con datos previos a la regla siga guardando sin ser bloqueado
// por filas heredadas; solo se valida lo nuevo o modificado.
func NewLocationRefs(incoming, existing []LocationRef) []LocationRef {
	seen := make(map[string]struct{}, len(existing))
	for _, r := range existing {
		seen[r.key()] = struct{}{}
	}
	var out []LocationRef
	for _, r := range incoming {
		if _, ok := seen[r.key()]; !ok {
			out = append(out, r)
		}
	}
	return out
}

// DepartmentViolation primera referencia cuyo departamento difiere del base; nil si todas cumplen.
func DepartmentViolation(base int, refs []LocationRef) *LocationRef {
	for i := range refs {
		if refs[i].DepartamentoID != nil && *refs[i].DepartamentoID != base {
			return &refs[i]
		}
	}
	return nil
}

// MunicipalityIDs ids de municipio distintos presentes en las referencias.
func MunicipalityIDs(refs []LocationRef) []int {
	seen := make(map[int]struct{})
	var ids []int
	for _, r := range refs {
		if r.MunicipioID == nil {
			continue
		}
		if _, ok := seen[*r.MunicipioID]; !ok {
			seen[*r.MunicipioID] = struct{}{}
			ids = append(ids, *r.MunicipioID)
		}
	}
	return ids
}

func refFromMap(m map[string]interface{}) (LocationRef, bool) {
	ref := LocationRef{
		DepartamentoID: firstInt(m, "departamento_id", "departamentoId"),
		MunicipioID:    firstInt(m, "municipio_id", "municipioId"),
	}
	return ref, ref.DepartamentoID != nil || ref.MunicipioID != nil
}

func firstInt(m map[string]interface{}, keys ...string) *int {
	for _, k := range keys {
		if v := anyToInt(m[k]); v != nil {
			return v
		}
	}
	return nil
}

func anyToInt(v interface{}) *int {
	switch n := v.(type) {
	case float64:
		i := int(n)
		return &i
	case int:
		return &n
	case int64:
		i := int(n)
		return &i
	case json.Number:
		if i, err := strconv.Atoi(n.String()); err == nil {
			return &i
		}
	case string:
		if i, err := strconv.Atoi(strings.TrimSpace(n)); err == nil {
			return &i
		}
	}
	return nil
}

func asSlice(v interface{}) []interface{} {
	s, _ := v.([]interface{})
	return s
}
