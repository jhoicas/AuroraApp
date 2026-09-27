package admin

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"aurora-backend/internal/domain/models"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
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

func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:admin_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.CatalogSyncLog{}, &models.PNDCatalog{}))
	return db
}

func TestPndSyncService_SyncPnd_TargetTablePndCatalog(t *testing.T) {
	db := newTestDB(t)

	// Verify that table pnd_catalog was created and has TableName "pnd_catalog"
	assert.Equal(t, "pnd_catalog", models.PNDCatalog{}.TableName())

	sampleRows := []RawSodaPndRow{
		{
			TipoPlanDesarrollo:             "Nacional",
			NombrePlanDesarrollo:           "Plan Nacional de Desarrollo 2026",
			NombreIndicador:                "Construcción de Vías Terciarias",
			UnidadMedida:                   "Kilómetros",
			MetaTotal:                      "2500",
			NivelPlanDesarrollo:            "Estrategia",
			DescripcionNivelPlanDesarrollo: "Infraestructura para la Paz",
			Meta:                           "777",
		},
	}

	var rawMessages []json.RawMessage
	for _, row := range sampleRows {
		b, _ := json.Marshal(row)
		rawMessages = append(rawMessages, b)
	}

	mockClient := &mockSodaClient{records: rawMessages}
	service := NewPndSyncService(db, mockClient)

	// Ejecutar Sync
	res, err := service.SyncPnd(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, res.RecordsProcessed)
	assert.Equal(t, "SUCCESS", res.Status)

	// Verificar que los datos existen en la tabla pnd_catalog
	var count int64
	err = db.Table("pnd_catalog").Count(&count).Error
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)

	var pnd models.PNDCatalog
	err = db.Table("pnd_catalog").First(&pnd).Error
	require.NoError(t, err)
	assert.Equal(t, "Plan Nacional de Desarrollo 2026", *pnd.PlanName)
	assert.Equal(t, "Construcción de Vías Terciarias", pnd.ComponentDescription)
	assert.Equal(t, "Infraestructura para la Paz", pnd.ObjectiveDescription)
	assert.Equal(t, 777, pnd.ComponentID)

	// Verificar consulta de estado
	status, err := service.GetLatestSyncStatus(context.Background(), "PND")
	require.NoError(t, err)
	require.NotNil(t, status)
	assert.Equal(t, models.CatalogSyncStatus("SUCCESS"), status.Status)
	assert.Equal(t, 1, status.RecordsProcessed)
}

func TestPndSyncService_SyncPnd_FailureHandling(t *testing.T) {
	db := newTestDB(t)

	mockClient := &mockSodaClient{err: errors.New("soda network connection failed")}
	service := NewPndSyncService(db, mockClient)

	res, err := service.SyncPnd(context.Background())
	require.Error(t, err)
	assert.Nil(t, res)

	status, err := service.GetLatestSyncStatus(context.Background(), "PND")
	require.NoError(t, err)
	require.NotNil(t, status)
	assert.Equal(t, models.CatalogSyncStatus("FAILED"), status.Status)
	assert.Contains(t, status.ErrorMessage, "soda network connection failed")
}
