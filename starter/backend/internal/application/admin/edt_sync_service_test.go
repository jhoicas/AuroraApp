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

func newEdtTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:edt_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&models.CatalogSyncLog{},
		&models.CatalogProduct{},
		&models.CatalogEdt{},
	))
	return db
}

func TestEdtSyncService_SyncEdt_ResolvesProductFKAndProtectedUpsert(t *testing.T) {
	db := newEdtTestDB(t)

	assert.Equal(t, "catalogo_edt", models.CatalogEdt{}.TableName())

	// 1. Crear Producto base en DB
	prodID := uuid.New()
	product1 := models.CatalogProduct{
		ID:                      prodID,
		CodigoProducto:          "0101001",
		Producto:                "Asistencia Técnica Agropecuaria",
		CodigoIndicadorProducto: "IND01",
		CreatedAt:               time.Now(),
	}
	require.NoError(t, db.Create(&product1).Error)

	// 2. Pre-insertar EDT existente con observaciones protegidas
	existingEdt := models.CatalogEdt{
		ID:                          uuid.New(),
		ProductID:                   &prodID,
		CodigoProductoEstandarizado: "0101001",
		NombreProducto:              "Asistencia Técnica Agropecuaria",
		CodigoEntregableL1:          "01",
		NombreEntregableL1:          "Entregable Antiguo L1",
		CodigoEntregableL2:          "0101",
		NombreEntregableL2:          "Entregable Antiguo L2",
		CodigoEntregableL3:          "010101",
		NombreEntregableL3:          "Entregable Antiguo L3",
		CodigoActividad:             "ACT01",
		Actividad:                   "Actividad Antigua",
		UnidadDeMedida:              "Unidades",
		Observaciones:               "Notas tecnicas de obra territorial - NO SOBREESCRIBIR",
		CreatedAt:                   time.Now().Add(-6 * time.Hour),
		UpdatedAt:                   time.Now().Add(-6 * time.Hour),
	}
	require.NoError(t, db.Create(&existingEdt).Error)

	// 3. Mockear filas SODA:
	// - Una que actualiza el EDT existente (debe mantener observaciones intactas)
	// - Una nueva con el producto válido 0101001
	// - Una con producto fantasma 9999999 (debe ser omitida)
	sampleRows := []RawSodaEdtRow{
		{
			CodigoProductoEstandarizado: "0101001",
			NombreProducto:              "Asistencia Técnica Agropecuaria Actualizada",
			CodigoEntregableL1:          "01",
			NombreEntregableL1:          "Entregable Oficial L1",
			CodigoEntregableL2:          "0101",
			NombreEntregableL2:          "Entregable Oficial L2",
			CodigoEntregableL3:          "010101",
			NombreEntregableL3:          "Entregable Oficial L3",
			CodigoActividad:             "ACT01",
			Actividad:                   "Capacitación en Buenas Prácticas Agrícolas",
			UnidadDeMedida:              "Talleres",
			Observaciones:               "Intento de sobreescritura maliciosa desde SODA",
		},
		{
			CodigoProductoEstandarizado: "0101001",
			NombreProducto:              "Asistencia Técnica Agropecuaria",
			CodigoEntregableL1:          "01",
			NombreEntregableL1:          "Entregable Oficial L1",
			CodigoEntregableL2:          "0101",
			NombreEntregableL2:          "Entregable Oficial L2",
			CodigoEntregableL3:          "010101",
			NombreEntregableL3:          "Entregable Oficial L3",
			CodigoActividad:             "ACT02",
			Actividad:                   "Visitas de Asistencia en Finca",
			UnidadDeMedida:              "Visitas",
		},
		{
			CodigoProductoEstandarizado: "9999999", // Producto fantasma
			CodigoActividad:             "ACT99",
			Actividad:                   "Actividad Huérfana",
		},
	}

	var data []map[string]interface{}
	for _, row := range sampleRows {
		b, _ := json.Marshal(row)
		var item map[string]interface{}
		_ = json.Unmarshal(b, &item)
		data = append(data, item)
	}

	service := NewEdtSyncService(db)

	// 4. Ejecutar sincronización
	res, err := service.SyncEdt(context.Background(), data)
	require.NoError(t, err)
	assert.Equal(t, 2, res.RecordsProcessed, "debe procesar 2 registros y omitir el del producto fantasma 9999999")
	assert.Equal(t, "SUCCESS", res.Status)

	// 5. Verificar que ACT01 actualizó datos pero conservó observaciones
	var updated models.CatalogEdt
	err = db.Where("codigo_producto_estandarizado = ? AND codigo_actividad = ?", "0101001", "ACT01").First(&updated).Error
	require.NoError(t, err)
	assert.Equal(t, "Capacitación en Buenas Prácticas Agrícolas", updated.Actividad)
	assert.Equal(t, "Talleres", updated.UnidadDeMedida)
	assert.Equal(t, &prodID, updated.ProductID, "debe resolver la FK hacia ProductID")
	assert.Equal(t, "Notas tecnicas de obra territorial - NO SOBREESCRIBIR", updated.Observaciones, "las observaciones deben estar protegidas y no sobreescribirse")

	// 6. Verificar inserción de nueva actividad ACT02
	var newEdt models.CatalogEdt
	err = db.Where("codigo_producto_estandarizado = ? AND codigo_actividad = ?", "0101001", "ACT02").First(&newEdt).Error
	require.NoError(t, err)
	assert.Equal(t, "Visitas de Asistencia en Finca", newEdt.Actividad)
	assert.Equal(t, &prodID, newEdt.ProductID)

	// 7. Verificar que el EDT fantasma no fue insertado
	var countGhost int64
	db.Model(&models.CatalogEdt{}).Where("codigo_producto_estandarizado = ?", "9999999").Count(&countGhost)
	assert.Equal(t, int64(0), countGhost)

	// 8. Verificar log de auditoría
	status, err := service.GetLatestSyncStatus(context.Background(), "EDT")
	require.NoError(t, err)
	require.NotNil(t, status)
	assert.Equal(t, models.CatalogSyncStatus("SUCCESS"), status.Status)
	assert.Equal(t, 2, status.RecordsProcessed)
	assert.Equal(t, "EDT", status.CatalogName)
}

func TestEdtSyncService_SyncEdt_FailureHandling(t *testing.T) {
	db := newEdtTestDB(t)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())

	service := NewEdtSyncService(db)

	res, err := service.SyncEdt(context.Background(), []map[string]interface{}{{"codigo_producto_estandarizado": "0101001"}})
	require.Error(t, err)
	assert.Nil(t, res)

	assert.Contains(t, err.Error(), "closed")
}
