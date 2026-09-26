package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"aurora-backend/internal/domain/models"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminLocationHandler_TipoAgrupacionAndAgrupacion(t *testing.T) {
	db := newSQLiteDB(t)
	err := db.AutoMigrate(
		&models.Region{},
		&models.Departamento{},
		&models.Municipio{},
		&models.TipoAgrupacion{},
		&models.Agrupacion{},
	)
	require.NoError(t, err)

	now := time.Now().UTC()
	// Seed Municipio
	reg := models.Region{ID: 1, Name: "Pacífico", IsActive: true, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, db.Create(&reg).Error)
	dep := models.Departamento{ID: 76, Name: "Valle del Cauca", RegionID: 1, IsActive: true, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, db.Create(&dep).Error)
	mun := models.Municipio{ID: 76001, Name: "Cali", DepartamentoID: 76, IsActive: true, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, db.Create(&mun).Error)

	handler := NewAdminLocationHandler(db)

	app := fiber.New()
	app.Post("/admin/locations/tipos-agrupacion", handler.CreateTipoAgrupacion)
	app.Get("/locations/tipos-agrupacion", handler.ListTiposAgrupacion)
	app.Post("/admin/locations/agrupaciones", handler.CreateAgrupacion)
	app.Get("/locations/agrupaciones", handler.ListAgrupaciones)
	app.Get("/admin/locations", handler.ListAdminLocations)

	// 1. Create TipoAgrupacion
	tipoBody, _ := json.Marshal(map[string]interface{}{
		"name": "Resguardo Indígena",
	})
	req := httptest.NewRequest(http.MethodPost, "/admin/locations/tipos-agrupacion", bytes.NewReader(tipoBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var createdTipo models.TipoAgrupacion
	err = json.NewDecoder(resp.Body).Decode(&createdTipo)
	require.NoError(t, err)
	assert.Equal(t, "Resguardo Indígena", createdTipo.Name)
	assert.True(t, createdTipo.ID > 0)

	// 2. List TiposAgrupacion
	req = httptest.NewRequest(http.MethodGet, "/locations/tipos-agrupacion", nil)
	resp, err = app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var listTipoResp struct {
		Data []models.TipoAgrupacion `json:"data"`
	}
	err = json.NewDecoder(resp.Body).Decode(&listTipoResp)
	require.NoError(t, err)
	assert.Len(t, listTipoResp.Data, 1)
	assert.Equal(t, "Resguardo Indígena", listTipoResp.Data[0].Name)

	// 3. Create Agrupacion
	agrupBody, _ := json.Marshal(map[string]interface{}{
		"name":               "Triunfo Cristal Paez",
		"municipio_id":       76001,
		"tipo_agrupacion_id": createdTipo.ID,
	})
	req = httptest.NewRequest(http.MethodPost, "/admin/locations/agrupaciones", bytes.NewReader(agrupBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err = app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var createdAgrup models.Agrupacion
	err = json.NewDecoder(resp.Body).Decode(&createdAgrup)
	require.NoError(t, err)
	assert.Equal(t, "Triunfo Cristal Paez", createdAgrup.Name)
	assert.Equal(t, 76001, createdAgrup.MunicipioID)
	assert.Equal(t, createdTipo.ID, createdAgrup.TipoAgrupacionID)

	// 4. List Agrupaciones with filters
	req = httptest.NewRequest(http.MethodGet, "/locations/agrupaciones?municipio_id=76001", nil)
	resp, err = app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var listAgrupResp struct {
		Data []models.Agrupacion `json:"data"`
	}
	err = json.NewDecoder(resp.Body).Decode(&listAgrupResp)
	require.NoError(t, err)
	assert.Len(t, listAgrupResp.Data, 1)
	assert.Equal(t, "Triunfo Cristal Paez", listAgrupResp.Data[0].Name)

	// 5. ListAdminLocations for agrupaciones
	req = httptest.NewRequest(http.MethodGet, "/admin/locations?type=agrupaciones", nil)
	resp, err = app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
