package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
)

func dnpDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:dnp_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.DnpVerb{}, &models.DnpStandardUnit{}))
	return db
}

func dnpApp(db *gorm.DB) *fiber.App {
	h := NewDnpDictionaryHandler(db)
	app := fiber.New()
	app.Get("/dict", h.Dictionary)
	app.Get("/verbs", h.ListVerbs)
	app.Post("/verbs", h.CreateVerb)
	app.Put("/verbs/:id", h.UpdateVerb)
	app.Delete("/verbs/:id", h.DeleteVerb)
	app.Get("/units", h.ListUnits)
	app.Post("/units", h.CreateUnit)
	app.Put("/units/:id", h.UpdateUnit)
	app.Delete("/units/:id", h.DeleteUnit)
	return app
}

func sendJSON(t *testing.T, app *fiber.App, method, path string, body any) (int, map[string]any) {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rdr = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rdr)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	raw, _ := io.ReadAll(resp.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return resp.StatusCode, out
}

func TestDnpDictionarySeed_IdempotentAndPdfWins(t *testing.T) {
	db := dnpDB(t)
	require.NoError(t, postgres.EnsureDnpDictionarySeed(db))
	var verbs, units int64
	db.Model(&models.DnpVerb{}).Count(&verbs)
	db.Model(&models.DnpStandardUnit{}).Count(&units)
	require.Greater(t, verbs, int64(200))
	require.EqualValues(t, 24, units)

	require.NoError(t, postgres.EnsureDnpDictionarySeed(db))
	var verbs2 int64
	db.Model(&models.DnpVerb{}).Count(&verbs2)
	require.Equal(t, verbs, verbs2)

	for _, w := range []string{"Apropiar", "Consolidar", "Desarrollar", "Fortalecer", "Implementar", "Mejorar", "Proponer", "Promover"} {
		var v models.DnpVerb
		require.NoError(t, db.Where("verb = ?", w).First(&v).Error, w)
		require.Equal(t, models.DnpVerbKindWeak, v.Kind, w)
	}
	var strong models.DnpVerb
	require.NoError(t, db.Where("verb = ?", "Diseñar").First(&strong).Error)
	require.Equal(t, models.DnpVerbKindStrong, strong.Kind)
}

func TestDnpDictionarySeed_DoesNotRestoreDeleted(t *testing.T) {
	db := dnpDB(t)
	require.NoError(t, postgres.EnsureDnpDictionarySeed(db))
	require.NoError(t, db.Where("verb = ?", "Analizar").Delete(&models.DnpVerb{}).Error)
	require.NoError(t, postgres.EnsureDnpDictionarySeed(db))
	var n int64
	db.Model(&models.DnpVerb{}).Where("verb = ?", "Analizar").Count(&n)
	require.Zero(t, n)
}

func TestDnpDictionaryHandler_VerbCRUD(t *testing.T) {
	app := dnpApp(dnpDB(t))

	code, created := sendJSON(t, app, "POST", "/verbs", map[string]any{"verb": "  georreferenciar ", "kind": "strong"})
	require.Equal(t, 201, code)
	require.Equal(t, "Georreferenciar", created["verb"])
	require.Equal(t, "STRONG", created["kind"])
	id := int(created["id"].(float64))

	code, _ = sendJSON(t, app, "POST", "/verbs", map[string]any{"verb": "GEORREFERENCIAR", "kind": "WEAK"})
	require.Equal(t, 409, code)

	code, _ = sendJSON(t, app, "POST", "/verbs", map[string]any{"verb": "dos palabras", "kind": "WEAK"})
	require.Equal(t, 400, code)
	code, _ = sendJSON(t, app, "POST", "/verbs", map[string]any{"verb": "Hacer", "kind": "MEDIUM"})
	require.Equal(t, 400, code)

	code, updated := sendJSON(t, app, "PUT", "/verbs/"+dnpItoa(id), map[string]any{"verb": "Georreferenciar", "kind": "WEAK", "notes": "x"})
	require.Equal(t, 200, code)
	require.Equal(t, "WEAK", updated["kind"])

	code, list := sendJSON(t, app, "GET", "/verbs?kind=WEAK&search=georre", nil)
	require.Equal(t, 200, code)
	require.Len(t, list["data"], 1)

	code, _ = sendJSON(t, app, "DELETE", "/verbs/"+dnpItoa(id), nil)
	require.Equal(t, 204, code)
	code, _ = sendJSON(t, app, "DELETE", "/verbs/"+dnpItoa(id), nil)
	require.Equal(t, 404, code)
}

func TestDnpDictionaryHandler_UnitCRUDAndDictionary(t *testing.T) {
	db := dnpDB(t)
	require.NoError(t, postgres.EnsureDnpDictionarySeed(db))
	app := dnpApp(db)

	code, created := sendJSON(t, app, "POST", "/units", map[string]any{"name": "Kilovatios hora", "symbol": "kWh", "typology": "energia"})
	require.Equal(t, 201, code)
	require.Equal(t, true, created["active"])
	id := int(created["id"].(float64))

	code, _ = sendJSON(t, app, "POST", "/units", map[string]any{"name": "Pulgadas", "typology": "OTRA"})
	require.Equal(t, 400, code)
	code, _ = sendJSON(t, app, "POST", "/units", map[string]any{"name": "número", "typology": "CONTEO"})
	require.Equal(t, 409, code)

	code, _ = sendJSON(t, app, "PUT", "/units/"+dnpItoa(id), map[string]any{"name": "Kilovatios hora", "symbol": "kWh", "typology": "ENERGIA", "active": false})
	require.Equal(t, 200, code)

	code, list := sendJSON(t, app, "GET", "/units?typology=ENERGIA", nil)
	require.Equal(t, 200, code)
	require.Len(t, list["data"], 4)

	code, dict := sendJSON(t, app, "GET", "/dict", nil)
	require.Equal(t, 200, code)
	require.Len(t, dict["units"], 24, "inactive units are excluded")
	require.Contains(t, dict["weak_verbs"], "Fortalecer")
	require.Contains(t, dict["strong_verbs"], "Elaborar")
}

func TestBuildDnpRules_UsesDatabaseValues(t *testing.T) {
	db := dnpDB(t)
	repo := postgres.NewDnpDictionaryRepository(db)
	ctx := context.Background()
	require.NoError(t, repo.CreateVerb(ctx, &models.DnpVerb{Verb: "Zonificar", Kind: models.DnpVerbKindStrong}))
	require.NoError(t, repo.CreateVerb(ctx, &models.DnpVerb{Verb: "Fortalecer", Kind: models.DnpVerbKindWeak}))
	require.NoError(t, repo.CreateUnit(ctx, &models.DnpStandardUnit{Name: "Número", Typology: models.DnpUnitTypologyConteo, Active: true}))

	h := &AIHandler{dnp: repo}
	dict := h.loadDnpDictionary(ctx)

	activity := buildDnpRules("actividad_descripcion_abc", dict)
	require.Contains(t, activity, "VERBO RECTOR FUERTE EN INFINITIVO + SUSTANTIVO DIRECTO")
	require.Contains(t, activity, "VERBOS FUERTES: Zonificar")
	require.Contains(t, activity, "PROHIBIDO usar estos verbos débiles: Fortalecer")

	indicator := buildDnpRules("indicador_objetivo_nombre", dict)
	require.Contains(t, indicator, "SUSTANTIVO DIRECTO + PARTICIPIO")
	require.Contains(t, indicator, "Zonificar")

	unit := buildDnpRules("necesidad_unidad_medida", dict)
	require.Contains(t, unit, "CONTEO: Número")
	require.Contains(t, unit, "nunca \"Informe\"")

	objective := buildDnpRules("objetivo_general", dict)
	require.True(t, strings.HasPrefix(objective, "REGLA CRÍTICA"))
	require.Contains(t, objective, "Zonificar")

	require.Empty(t, buildDnpRules("indicador_producto_fuente", dict))
	require.Empty(t, buildDnpRules("situacion_existente", dict))

	empty := buildDnpRules("actividad", dnpDictionary{})
	require.NotContains(t, empty, "VERBOS FUERTES:")
	require.Contains(t, empty, "VERBO RECTOR FUERTE")
}

func dnpItoa(i int) string { return strconv.Itoa(i) }
