package admin

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"aurora-backend/internal/domain/models"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newSectorTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:sector_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.CatalogSyncLog{}, &models.Sector{}))
	return db
}

func TestSectorSyncService_SyncSectors_ProtectedUpsertPreservesObservations(t *testing.T) {
	db := newSectorTestDB(t)

	// Verificar que el modelo Sector apunte a la tabla 'sectores'
	assert.Equal(t, "sectores", models.Sector{}.TableName())

	// 1. Insertar un sector inicial con observaciones personalizadas
	initialSector := models.Sector{
		ID:           uuid.New(),
		Code:         "SEC-01",
		Name:         "Sector Original",
		Application:  "Aplicación Antigua",
		Observations: "Nota interna confidencial del municipio - NO TOCAR",
		CreatedAt:    time.Now().Add(-1 * time.Hour),
		UpdatedAt:    time.Now().Add(-1 * time.Hour),
	}
	require.NoError(t, db.Create(&initialSector).Error)

	// 2. Mockear datos provenientes de SODA con el mismo código pero nombre y aplicación actualizados
	sampleRows := []RawSodaSectorRow{
		{
			Codigo:      "SEC-01",
			Nombre:      "Sector Actualizado DNP",
			Aplicacion:  "Nueva Aplicación Nacional 2026",
			Descripcion: "Descripción ignorada si aplicacion existe",
		},
		{
			Codigo:      "SEC-02",
			Nombre:      "Nuevo Sector DNP",
			Aplicacion:  "Infraestructura",
			Descripcion: "Aplicación para nuevo sector",
		},
	}

	var data []map[string]interface{}
	for _, row := range sampleRows {
		b, _ := json.Marshal(row)
		var item map[string]interface{}
		_ = json.Unmarshal(b, &item)
		data = append(data, item)
	}

	service := NewSectorSyncService(db)

	// 3. Ejecutar Sincronización
	res, err := service.SyncSectors(context.Background(), data)
	require.NoError(t, err)
	assert.Equal(t, 2, res.RecordsProcessed)
	assert.Equal(t, "SUCCESS", res.Status)

	// 4. Verificar que SEC-01 actualizó nombre y aplicación, pero PROTEGIÓ observaciones
	var updatedSEC01 models.Sector
	err = db.Where("codigo = ?", "SEC-01").First(&updatedSEC01).Error
	require.NoError(t, err)
	assert.Equal(t, "Sector Actualizado DNP", updatedSEC01.Name)
	assert.Equal(t, "Nueva Aplicación Nacional 2026", updatedSEC01.Application)
	assert.Equal(t, "Nota interna confidencial del municipio - NO TOCAR", updatedSEC01.Observations, "el campo observaciones debe preservarse intacto tras el upsert")

	// 5. Verificar que SEC-02 fue insertado con éxito
	var newSEC02 models.Sector
	err = db.Where("codigo = ?", "SEC-02").First(&newSEC02).Error
	require.NoError(t, err)
	assert.Equal(t, "Nuevo Sector DNP", newSEC02.Name)
	assert.Equal(t, "Infraestructura", newSEC02.Application)
	assert.Empty(t, newSEC02.Observations)

	// 6. Verificar auditoría en CatalogSyncLog
	status, err := service.GetLatestSyncStatus(context.Background(), "SECTORS")
	require.NoError(t, err)
	require.NotNil(t, status)
	assert.Equal(t, models.CatalogSyncStatus("SUCCESS"), status.Status)
	assert.Equal(t, 2, status.RecordsProcessed)
	assert.Equal(t, "SECTORS", status.CatalogName)
}

func TestSectorSyncService_SyncSectors_FailureHandling(t *testing.T) {
	db := newSectorTestDB(t)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())

	service := NewSectorSyncService(db)

	res, err := service.SyncSectors(context.Background(), []map[string]interface{}{{"codigo": "01", "nombre": "Test"}})
	require.Error(t, err)
	assert.Nil(t, res)

	assert.Contains(t, err.Error(), "closed")
}
