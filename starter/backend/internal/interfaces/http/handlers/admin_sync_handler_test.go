package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"aurora-backend/internal/application/admin"
	"aurora-backend/internal/domain/models"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockSodaClient struct {
	records []json.RawMessage
	err     error
}

func (m *mockSodaClient) FetchAll(ctx context.Context, resourceID string, queryParams map[string]string) ([]json.RawMessage, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.records, nil
}

func (m *mockSodaClient) FetchAllRaw(ctx context.Context, resourceID string, queryParams map[string]string) ([]byte, error) {
	if m.err != nil {
		return nil, m.err
	}
	return json.Marshal(m.records)
}

func (m *mockSodaClient) FetchAllInterfaces(ctx context.Context, resourceID string, queryParams map[string]string) ([]map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	var res []map[string]any
	for _, r := range m.records {
		var item map[string]any
		_ = json.Unmarshal(r, &item)
		res = append(res, item)
	}
	return res, nil
}

func (m *mockSodaClient) FetchPage(ctx context.Context, resourceID string, limit, offset int, queryParams map[string]string) ([]json.RawMessage, error) {
	return m.FetchAll(ctx, resourceID, queryParams)
}

func TestAdminSyncHandler_GetSyncStatus_Empty(t *testing.T) {
	db := newSQLiteDB(t)
	require.NoError(t, db.AutoMigrate(&models.CatalogSyncLog{}, &models.PNDCatalog{}))

	mockClient := &mockSodaClient{}
	syncService := admin.NewPndSyncService(db, mockClient)
	handler := NewAdminSyncHandlerWithService(syncService)

	app := fiber.New()
	app.Get("/api/v1/admin/sync/status", handler.GetSyncStatus)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sync/status?catalog=PND", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]any
	err = json.NewDecoder(resp.Body).Decode(&body)
	require.NoError(t, err)
	assert.Nil(t, body["data"])
}

func TestAdminSyncHandler_TriggerSyncAndStatus(t *testing.T) {
	db := newSQLiteDB(t)
	require.NoError(t, db.AutoMigrate(&models.CatalogSyncLog{}, &models.PNDCatalog{}))

	sampleRows := []admin.RawSodaPndRow{
		{
			TipoPlanDesarrollo:             "Nacional",
			NombrePlanDesarrollo:           "Plan Colombia 2026",
			NombreIndicador:                "Viviendas Mejoradas",
			UnidadMedida:                   "Número",
			MetaTotal:                      "1000",
			NivelPlanDesarrollo:            "Línea",
			DescripcionNivelPlanDesarrollo: "Vivienda Digna",
			Meta:                           "500",
		},
		{
			TipoPlanDesarrollo:             "Nacional",
			NombrePlanDesarrollo:           "Plan Colombia 2026",
			NombreIndicador:                "Agua Potable",
			UnidadMedida:                   "Porcentaje",
			MetaTotal:                      "100",
			NivelPlanDesarrollo:            "Objetivo",
			DescripcionNivelPlanDesarrollo: "Sostenibilidad",
			Meta:                           "501",
		},
	}

	var rawMessages []json.RawMessage
	for _, row := range sampleRows {
		b, _ := json.Marshal(row)
		rawMessages = append(rawMessages, b)
	}

	mockClient := &mockSodaClient{records: rawMessages}
	syncService := admin.NewPndSyncService(db, mockClient)
	handler := NewAdminSyncHandlerWithService(syncService)

	app := fiber.New()
	app.Get("/api/v1/admin/sync/status", handler.GetSyncStatus)
	app.Post("/api/v1/admin/sync/pnd", handler.TriggerSync)

	// 1. Trigger Sync
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/sync/pnd", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var triggerBody struct {
		Status string              `json:"status"`
		Data   admin.PndSyncResult `json:"data"`
	}
	err = json.NewDecoder(resp.Body).Decode(&triggerBody)
	require.NoError(t, err)
	assert.Equal(t, "success", triggerBody.Status)
	assert.Equal(t, 2, triggerBody.Data.RecordsProcessed)
	assert.Equal(t, "SUCCESS", triggerBody.Data.Status)

	// 2. Verify GetSyncStatus returns SUCCESS and records_processed = 2
	reqStatus := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sync/status?catalog=PND", nil)
	respStatus, err := app.Test(reqStatus)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, respStatus.StatusCode)

	var statusBody struct {
		Data *models.CatalogSyncLog `json:"data"`
	}
	err = json.NewDecoder(respStatus.Body).Decode(&statusBody)
	require.NoError(t, err)
	require.NotNil(t, statusBody.Data)
	assert.Equal(t, models.CatalogSyncStatus("SUCCESS"), statusBody.Data.Status)
	assert.Equal(t, 2, statusBody.Data.RecordsProcessed)

	// 3. Trigger again (idempotent upsert verification)
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/admin/sync/pnd", nil)
	resp2, err := app.Test(req2)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp2.StatusCode)

	var count int64
	db.Model(&models.PNDCatalog{}).Count(&count)
	assert.Equal(t, int64(2), count, "no debe duplicar registros existentes al re-sincronizar")
}

func TestAdminSyncHandler_TriggerSectorsSyncAndStatus(t *testing.T) {
	db := newSQLiteDB(t)
	require.NoError(t, db.AutoMigrate(&models.CatalogSyncLog{}, &models.Sector{}))

	sampleRows := []admin.RawSodaSectorRow{
		{
			Codigo:      "01",
			Nombre:      "Agricultura y Desarrollo Rural",
			Aplicacion:  "Nacional y Territorial",
			Descripcion: "Sector de agricultura",
		},
		{
			Codigo:      "02",
			Nombre:      "Salud y Protección Social",
			Aplicacion:  "Nacional",
			Descripcion: "Sector de salud",
		},
	}

	var rawMessages []json.RawMessage
	for _, row := range sampleRows {
		b, _ := json.Marshal(row)
		rawMessages = append(rawMessages, b)
	}

	mockClient := &mockSodaClient{records: rawMessages}
	pndSyncService := admin.NewPndSyncService(db, mockClient)
	sectorSyncService := admin.NewSectorSyncService(db, mockClient)
	handler := NewAdminSyncHandlerWithService(pndSyncService, sectorSyncService)

	app := fiber.New()
	app.Get("/api/v1/admin/sync/status", handler.GetSyncStatus)
	app.Post("/api/v1/admin/sync/sectors", handler.TriggerSectorsSync)

	// 1. Trigger Sectors Sync
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/sync/sectors", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var triggerBody struct {
		Status string                 `json:"status"`
		Data   admin.SectorSyncResult `json:"data"`
	}
	err = json.NewDecoder(resp.Body).Decode(&triggerBody)
	require.NoError(t, err)
	assert.Equal(t, "success", triggerBody.Status)
	assert.Equal(t, 2, triggerBody.Data.RecordsProcessed)
	assert.Equal(t, "SUCCESS", triggerBody.Data.Status)
	assert.Equal(t, "SECTORS", triggerBody.Data.CatalogName)

	// 2. Status check for SECTORS
	reqStatus := httptest.NewRequest(http.MethodGet, "/api/v1/admin/sync/status?catalog=SECTORS", nil)
	respStatus, err := app.Test(reqStatus)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, respStatus.StatusCode)

	var statusBody struct {
		Data *models.CatalogSyncLog `json:"data"`
	}
	err = json.NewDecoder(respStatus.Body).Decode(&statusBody)
	require.NoError(t, err)
	require.NotNil(t, statusBody.Data)
	assert.Equal(t, models.CatalogSyncStatus("SUCCESS"), statusBody.Data.Status)
	assert.Equal(t, 2, statusBody.Data.RecordsProcessed)
	assert.Equal(t, "SECTORS", statusBody.Data.CatalogName)

	// 3. Verify sectors are created in DB
	var sectorCount int64
	db.Model(&models.Sector{}).Count(&sectorCount)
	assert.Equal(t, int64(2), sectorCount)
}
