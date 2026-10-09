package handlers

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"aurora-backend/internal/domain/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	deptValle  = 76
	deptBogota = 11
	deptAntio  = 5
)

func jsonRaw(s string) json.RawMessage { return json.RawMessage(s) }

type locationRuleEnv struct {
	app      *fiber.App
	db       *gorm.DB
	identity identity
}

func newLocationRuleEnv(t *testing.T) *locationRuleEnv {
	t.Helper()
	db := newSQLiteDB(t)

	ddls := []string{
		`CREATE TABLE projects (
			id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, creator_id TEXT NOT NULL, code_bpin TEXT,
			name TEXT NOT NULL, description TEXT, sector TEXT, sector_id TEXT, program_code TEXT,
			product_code TEXT, problem_description TEXT, general_objective TEXT,
			situacion_existente TEXT, magnitud_problema TEXT, proceso_id INTEGER, tipologia TEXT, tipo_inversion TEXT, fase_maduracion TEXT DEFAULT 'PERFIL',
			mga_formulation_data TEXT DEFAULT '{}', status TEXT NOT NULL DEFAULT 'DRAFT',
			created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME
		)`,
		`CREATE TABLE departamentos (
			id INTEGER PRIMARY KEY, name TEXT NOT NULL, region_id INTEGER NOT NULL,
			is_active BOOLEAN NOT NULL DEFAULT 1, created_at DATETIME, updated_at DATETIME
		)`,
		`CREATE TABLE municipios (
			id INTEGER PRIMARY KEY, name TEXT NOT NULL, departamento_id INTEGER NOT NULL,
			is_active BOOLEAN NOT NULL DEFAULT 1, created_at DATETIME, updated_at DATETIME
		)`,
		`CREATE TABLE mga_populations (
			id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, project_id TEXT NOT NULL,
			population_type TEXT NOT NULL, total_number INTEGER NOT NULL DEFAULT 0,
			source TEXT NOT NULL, locations TEXT NOT NULL DEFAULT '[]',
			created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, deleted_at DATETIME
		)`,
		`INSERT INTO departamentos (id, name, region_id) VALUES (76, 'Valle del Cauca', 3), (11, 'Bogotá D.C.', 1), (5, 'Antioquia', 2)`,
		`INSERT INTO municipios (id, name, departamento_id) VALUES
			(76001, 'Cali', 76), (76109, 'Buenaventura', 76), (11001, 'Bogotá', 11), (5001, 'Medellín', 5)`,
	}
	for _, ddl := range ddls {
		require.NoError(t, db.Exec(ddl).Error)
	}

	id := validIdentity()
	ph := NewProjectHandler(db)
	mh := NewMgaHandler(db)

	app := newTestApp()
	app.Use(injectIdentity(id))
	app.Post("/projects", ph.Create)
	app.Get("/projects/:id", ph.GetByID)
	app.Patch("/projects/:id", ph.Patch)
	app.Post("/projects/:id/mga/populations", mh.CreatePopulation)
	app.Put("/projects/:id/mga/populations/:populationId", mh.UpdatePopulation)

	return &locationRuleEnv{app: app, db: db, identity: id}
}

type projectView struct {
	ID                 string                 `json:"id"`
	BaseRegionID       *int                   `json:"base_region_id"`
	BaseDepartamentoID *int                   `json:"base_departamento_id"`
	MgaFormulationData map[string]interface{} `json:"mga_formulation_data"`
}

func (e *locationRuleEnv) createProject(t *testing.T, localizaciones []map[string]interface{}) projectView {
	t.Helper()
	resp := doJSON(t, e.app, http.MethodPost, "/projects", map[string]interface{}{
		"name":           "Proyecto de prueba",
		"sector":         "Vivienda",
		"sector_id":      uuid.NewString(),
		"product_code":   "4001001",
		"proceso_id":     1,
		"objeto":         "Construcción de acueducto rural",
		"tipo_inversion": "Infraestructura",
		"tipologia":      "General - Esquemas SUIFP",
		"localizaciones": localizaciones,
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var p projectView
	decodeBody(t, resp, &p)
	return p
}

func (e *locationRuleEnv) getProject(t *testing.T, id string) projectView {
	t.Helper()
	resp := doJSON(t, e.app, http.MethodGet, "/projects/"+id, nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	var p projectView
	decodeBody(t, resp, &p)
	return p
}

func (e *locationRuleEnv) patch(t *testing.T, id string, mga map[string]interface{}) *http.Response {
	t.Helper()
	return doJSON(t, e.app, http.MethodPatch, "/projects/"+id, map[string]interface{}{"mga_formulation_data": mga})
}

func poblacionPatch(locs ...map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"identificacion": map[string]interface{}{
			"poblacion": map[string]interface{}{
				"afectada": map[string]interface{}{"localizaciones": locs},
			},
		},
	}
}

func loc(dept, mun int) map[string]interface{} {
	m := map[string]interface{}{}
	if dept != 0 {
		m["departamentoId"] = dept
	}
	if mun != 0 {
		m["municipioId"] = mun
	}
	return m
}

func TestCreateProject_FijaYExponeDepartamentoBase(t *testing.T) {
	env := newLocationRuleEnv(t)
	created := env.createProject(t, []map[string]interface{}{{"departamento_id": deptValle, "municipio_id": 76001}})

	require.NotNil(t, created.BaseDepartamentoID)
	require.Equal(t, deptValle, *created.BaseDepartamentoID)
	require.NotNil(t, created.BaseRegionID, "la región base se completa desde el catálogo de departamentos")
	require.Equal(t, 3, *created.BaseRegionID)

	got := env.getProject(t, created.ID)
	require.Equal(t, deptValle, *got.BaseDepartamentoID)
	require.Contains(t, got.MgaFormulationData, "localizacion_base")
}

func TestPatchPoblacion_RechazaDepartamentoDistintoAlBase(t *testing.T) {
	env := newLocationRuleEnv(t)
	p := env.createProject(t, []map[string]interface{}{{"departamento_id": deptValle, "municipio_id": 76001}})

	resp := env.patch(t, p.ID, poblacionPatch(loc(deptBogota, 11001)))
	payload := requireErrorJSON(t, resp, http.StatusBadRequest)
	require.Contains(t, payload.Error, "departamento base")
}

func TestPatchPoblacion_RechazaMunicipioDeOtroDepartamento(t *testing.T) {
	env := newLocationRuleEnv(t)
	p := env.createProject(t, []map[string]interface{}{{"departamento_id": deptValle}})

	// Sin departamento explícito pero con un municipio que no es del base.
	resp := env.patch(t, p.ID, poblacionPatch(loc(0, 5001)))
	requireErrorJSON(t, resp, http.StatusBadRequest)

	// Departamento correcto pero municipio de otro departamento.
	resp = env.patch(t, p.ID, poblacionPatch(loc(deptValle, 11001)))
	requireErrorJSON(t, resp, http.StatusBadRequest)

	// Municipio inexistente.
	resp = env.patch(t, p.ID, poblacionPatch(loc(deptValle, 99999)))
	requireErrorJSON(t, resp, http.StatusBadRequest)
}

func TestPatchPoblacion_AceptaMunicipiosDelDepartamentoBase(t *testing.T) {
	env := newLocationRuleEnv(t)
	p := env.createProject(t, []map[string]interface{}{{"departamento_id": deptValle}})

	resp := env.patch(t, p.ID, poblacionPatch(loc(deptValle, 76001), loc(0, 76109)))
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestPatchLocalizacion_AplicaLaMismaRegla(t *testing.T) {
	env := newLocationRuleEnv(t)
	p := env.createProject(t, []map[string]interface{}{{"departamento_id": deptValle}})

	bad := map[string]interface{}{
		"localizaciones": []map[string]interface{}{
			{"region_id": 3, "departamento_id": deptValle, "municipio_id": 76001},
			{"region_id": 2, "departamento_id": deptAntio, "municipio_id": 5001},
		},
	}
	requireErrorJSON(t, env.patch(t, p.ID, bad), http.StatusBadRequest)

	// También dentro de localizacion.localizaciones (lo que envía saveLocalizacion).
	nested := map[string]interface{}{"localizacion": bad}
	requireErrorJSON(t, env.patch(t, p.ID, nested), http.StatusBadRequest)

	ok := map[string]interface{}{
		"localizaciones": []map[string]interface{}{
			{"region_id": 3, "departamento_id": deptValle, "municipio_id": 76001},
			{"region_id": 3, "departamento_id": deptValle, "municipio_id": 76109},
		},
	}
	require.Equal(t, http.StatusOK, env.patch(t, p.ID, ok).StatusCode)
}

func TestPatch_NoPermiteCambiarLaLocalizacionBase(t *testing.T) {
	env := newLocationRuleEnv(t)
	p := env.createProject(t, []map[string]interface{}{{"departamento_id": deptValle, "municipio_id": 76001}})

	resp := env.patch(t, p.ID, map[string]interface{}{
		"localizacion_base": map[string]interface{}{"departamento_id": deptBogota, "region_id": 1},
	})
	require.Equal(t, http.StatusOK, resp.StatusCode)

	got := env.getProject(t, p.ID)
	require.Equal(t, deptValle, *got.BaseDepartamentoID)
	require.Equal(t, 3, *got.BaseRegionID)
}

func TestPatch_ProyectoPrevioALaReglaDerivaLaBaseYNoBloqueaLoYaGuardado(t *testing.T) {
	env := newLocationRuleEnv(t)

	// Proyecto "legacy": sin localizacion_base y con localizaciones en dos departamentos.
	legacyID := uuid.New()
	legacyData := `{"localizaciones": [
		{"region_id": 1, "departamento_id": 11, "municipio_id": 11001},
		{"region_id": 3, "departamento_id": 76, "municipio_id": 76001}
	]}`
	now := time.Now().UTC()
	require.NoError(t, env.db.Create(&models.Project{
		ID:                 legacyID,
		TenantID:           uuid.MustParse(env.identity.tenantID),
		CreatorID:          uuid.MustParse(env.identity.userID),
		Name:               "Legacy",
		Status:             "DRAFT",
		MgaFormulationData: datatypes.JSON(legacyData),
		CreatedAt:          now,
		UpdatedAt:          now,
	}).Error)

	// La base se deriva de la primera localización con departamento.
	got := env.getProject(t, legacyID.String())
	require.Equal(t, deptBogota, *got.BaseDepartamentoID)

	// Re-enviar lo ya guardado (aunque incumpla la regla) no bloquea el guardado.
	same := map[string]interface{}{
		"localizaciones": []map[string]interface{}{
			{"region_id": 1, "departamento_id": 11, "municipio_id": 11001},
			{"region_id": 3, "departamento_id": 76, "municipio_id": 76001},
		},
	}
	require.Equal(t, http.StatusOK, env.patch(t, legacyID.String(), same).StatusCode)

	// Lo nuevo sí se valida contra la base derivada.
	added := map[string]interface{}{
		"localizaciones": []map[string]interface{}{
			{"region_id": 1, "departamento_id": 11, "municipio_id": 11001},
			{"region_id": 3, "departamento_id": 76, "municipio_id": 76109},
		},
	}
	requireErrorJSON(t, env.patch(t, legacyID.String(), added), http.StatusBadRequest)

	// Tras el primer PATCH la base queda fijada y no se mueve.
	after := env.getProject(t, legacyID.String())
	require.Equal(t, deptBogota, *after.BaseDepartamentoID)
	require.Contains(t, after.MgaFormulationData, "localizacion_base")
}

func TestPoblacionEndpoints_ValidanUbicaciones(t *testing.T) {
	env := newLocationRuleEnv(t)
	p := env.createProject(t, []map[string]interface{}{{"departamento_id": deptValle}})
	base := "/projects/" + p.ID + "/mga/populations"

	payload := func(locations string) map[string]interface{} {
		return map[string]interface{}{
			"population_type": "afectada",
			"total_number":    100,
			"source":          "DANE",
			"locations":       jsonRaw(locations),
		}
	}

	// Fuera del departamento base → 400.
	requireErrorJSON(t, doJSON(t, env.app, http.MethodPost, base,
		payload(`[{"departamento_id": 11, "municipio_id": 11001}]`)), http.StatusBadRequest)
	requireErrorJSON(t, doJSON(t, env.app, http.MethodPost, base,
		payload(`[{"municipio_id": 5001}]`)), http.StatusBadRequest)

	// Dentro del base → 201.
	resp := doJSON(t, env.app, http.MethodPost, base, payload(`[{"departamento_id": 76, "municipio_id": 76001}]`))
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var created struct {
		ID string `json:"id"`
	}
	decodeBody(t, resp, &created)

	// Actualizar hacia otro departamento → 400; hacia el base → 200.
	put := base + "/" + created.ID
	requireErrorJSON(t, doJSON(t, env.app, http.MethodPut, put,
		map[string]interface{}{"locations": jsonRaw(`[{"departamento_id": 5, "municipio_id": 5001}]`)}),
		http.StatusBadRequest)
	resp = doJSON(t, env.app, http.MethodPut, put,
		map[string]interface{}{"locations": jsonRaw(`[{"departamento_id": 76, "municipio_id": 76109}]`)})
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestPoblacionEndpoints_UbicacionesSoloConNombresNoSeBloquean(t *testing.T) {
	env := newLocationRuleEnv(t)
	p := env.createProject(t, []map[string]interface{}{{"departamento_id": deptValle}})

	resp := doJSON(t, env.app, http.MethodPost, "/projects/"+p.ID+"/mga/populations", map[string]interface{}{
		"population_type": "objetivo",
		"total_number":    10,
		"source":          "Censo",
		"locations":       jsonRaw(`{"municipalities": ["Cali"], "departments": ["Valle del Cauca"]}`),
	})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
}
