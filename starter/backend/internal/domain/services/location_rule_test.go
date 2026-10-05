package services

import (
	"encoding/json"
	"testing"
)

func decode(t *testing.T, raw string) map[string]interface{} {
	t.Helper()
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func intp(v int) *int { return &v }

func TestResolveBaseLocation_ClaveReservadaTienePrioridad(t *testing.T) {
	data := decode(t, `{
		"localizacion_base": {"region_id": 5, "departamento_id": 76},
		"localizaciones": [{"region_id": 1, "departamento_id": 11}]
	}`)
	base := ResolveBaseLocation(data)
	if base == nil || base.DepartamentoID != 76 || base.RegionID == nil || *base.RegionID != 5 {
		t.Fatalf("base=%+v", base)
	}
}

func TestResolveBaseLocation_DerivaDeLaPrimeraLocalizacionConDepartamento(t *testing.T) {
	data := decode(t, `{"localizaciones": [{"region_id": 3}, {"regionId": 2, "departamentoId": "05", "municipioId": 5001}]}`)
	base := ResolveBaseLocation(data)
	if base == nil || base.DepartamentoID != 5 || base.RegionID == nil || *base.RegionID != 2 {
		t.Fatalf("base=%+v", base)
	}
}

func TestResolveBaseLocation_SinLocalizaciones(t *testing.T) {
	if ResolveBaseLocation(nil) != nil {
		t.Fatal("nil esperado con datos nil")
	}
	if ResolveBaseLocation(decode(t, `{"localizaciones": []}`)) != nil {
		t.Fatal("nil esperado sin localizaciones")
	}
}

func TestExtractLocationRefs_TodasLasRutas(t *testing.T) {
	data := decode(t, `{
		"localizaciones": [{"departamento_id": 76, "municipio_id": 76001}, {"region_id": 1}],
		"localizacion": {"localizaciones": [{"departamentoId": 76, "municipioId": 76109}]},
		"localizacionPreparacion": {"alt-1": {"ubicaciones": [{"departamentoId": 11}]}},
		"identificacion": {"poblacion": {
			"afectada": {"localizaciones": [{"departamentoId": 76, "municipioId": 76111}]},
			"objetivo": {"localizaciones": [{"departamentoId": 5, "municipioId": 5001}]}
		}}
	}`)
	refs := ExtractLocationRefs(data)
	if len(refs) != 5 {
		t.Fatalf("refs=%d want 5 (la fila solo con region se ignora): %+v", len(refs), refs)
	}
	v := DepartmentViolation(76, refs)
	if v == nil || *v.DepartamentoID != 11 {
		t.Fatalf("violación esperada con dpto 11 (primera fuera de base), got %+v", v)
	}
}

func TestDepartmentViolation_TodasEnBase(t *testing.T) {
	refs := []LocationRef{{DepartamentoID: intp(76), MunicipioID: intp(76001)}, {MunicipioID: intp(76109)}}
	if v := DepartmentViolation(76, refs); v != nil {
		t.Fatalf("no se esperaba violación: %+v", v)
	}
}

func TestExtractPopulationLocationRefs_Formas(t *testing.T) {
	cases := map[string]struct {
		raw  string
		want int
	}{
		"arreglo":          {`[{"departamento_id": 76, "municipio_id": 76001}, {"departamento_id": 5}]`, 2},
		"objeto directo":   {`{"departamento_id": 76, "municipio_id": 76001}`, 1},
		"objeto con lista": {`{"localizaciones": [{"departamentoId": 76}], "demographicNotes": "x"}`, 1},
		"solo nombres":     {`{"municipalities": ["Cali"], "departments": ["Valle"]}`, 0},
		"vacio":            {`[]`, 0},
		"json invalido":    {`{no`, 0},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			if got := len(ExtractPopulationLocationRefs(json.RawMessage(tc.raw))); got != tc.want {
				t.Fatalf("got %d want %d", got, tc.want)
			}
		})
	}
}

func TestNewLocationRefs_IgnoraLoYaExistente(t *testing.T) {
	existing := []LocationRef{{DepartamentoID: intp(11), MunicipioID: intp(11001)}}
	incoming := []LocationRef{
		{DepartamentoID: intp(11), MunicipioID: intp(11001)}, // heredada
		{DepartamentoID: intp(76), MunicipioID: intp(76001)}, // nueva
	}
	got := NewLocationRefs(incoming, existing)
	if len(got) != 1 || *got[0].DepartamentoID != 76 {
		t.Fatalf("got=%+v", got)
	}
}

func TestMunicipalityIDs_Distintos(t *testing.T) {
	ids := MunicipalityIDs([]LocationRef{
		{MunicipioID: intp(1)}, {MunicipioID: intp(1)}, {DepartamentoID: intp(2)}, {MunicipioID: intp(3)},
	})
	if len(ids) != 2 || ids[0] != 1 || ids[1] != 3 {
		t.Fatalf("ids=%v", ids)
	}
}
