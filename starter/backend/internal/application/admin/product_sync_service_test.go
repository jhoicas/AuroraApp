package admin

import (
	"context"
	"encoding/json"
	"errors"
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

func newProductTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:product_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&models.CatalogSyncLog{},
		&models.Sector{},
		&models.ProgramSubprogram{},
		&models.CatalogProduct{},
	))
	return db
}

func TestProductSyncService_SyncProducts_ResolvesProgramFKAndProtectedUpsert(t *testing.T) {
	db := newProductTestDB(t)

	assert.Equal(t, "catalogo_productos", models.CatalogProduct{}.TableName())

	// 1. Crear Programa base en DB
	progID := uuid.New()
	program1 := models.ProgramSubprogram{
		ID:                progID,
		SectorID:          uuid.New(),
		CodigoSector:      "01",
		NombreSector:      "Agricultura y Desarrollo Rural",
		CodigoPrograma:    "0101",
		NombrePrograma:    "Inclusión Productiva de Pequeños Productores",
		AmbitoAplicacion:  "Nacional",
		CodigoSubprograma: "010101",
		NombreSubprograma: "Acceso a Tierras",
		CreatedAt:         time.Now(),
	}
	require.NoError(t, db.Create(&program1).Error)

	// 2. Pre-insertar producto existente con observaciones protegidas
	existingProd := models.CatalogProduct{
		ID:                      uuid.New(),
		ProgramID:               &progID,
		Sector:                  "01",
		NombreSector:            "Agricultura y Desarrollo Rural",
		CodigoPrograma:          "0101",
		NombrePrograma:          "Inclusión Productiva de Pequeños Productores",
		CodigoProducto:          "0101001",
		Producto:                "Producto Antiguo",
		Descripcion:             "Descripcion Antigua",
		CodigoIndicadorProducto: "IND01",
		UnidadDeMedida:          "Hectáreas",
		Observaciones:           "Notas internas confidenciales - NO MODIFICAR EN SYNC",
		CreatedAt:               time.Now().Add(-5 * time.Hour),
		UpdatedAt:               time.Now().Add(-5 * time.Hour),
	}
	require.NoError(t, db.Create(&existingProd).Error)

	// 3. Mockear datos provenientes de SODA:
	// - Uno que actualiza 0101001 + IND01 (debe actualizar campos oficiales y preservar observaciones)
	// - Uno nuevo bajo programa 0101
	// - Uno con programa fantasma 9999 (debe ser omitido para mantener FK integrity)
	sampleRows := []RawSodaProductRow{
		{
			CodigoPrograma:          "0101",
			CodigoProducto:          "0101001",
			Producto:                "Asistencia Técnica Agropecuaria Integral",
			Descripcion:             "Acompañamiento a pequeños productores",
			CodigoIndicadorProducto: "IND01",
			IndicadorProducto:       "Número de hectáreas intervenidas",
			UnidadDeMedida:          "Hectáreas",
			EsNacional:              "SI",
			EsTerritorial:           "true",
			TipologiaGeneralSUIFP:   "General A",
			Observaciones:           "Sobreescritura maliciosa desde API",
		},
		{
			CodigoPrograma:          "0101",
			CodigoProducto:          "0101002",
			Producto:                "Crédito de Fomento Rural",
			Descripcion:             "Acceso a microcréditos para insumos",
			CodigoIndicadorProducto: "IND02",
			IndicadorProducto:       "Créditos colocados",
			UnidadDeMedida:          "Créditos",
			EsNacional:              true,
		},
		{
			CodigoPrograma:          "9999", // Programa fantasma (inexistente)
			CodigoProducto:          "9999001",
			Producto:                "Producto sin programa",
			CodigoIndicadorProducto: "IND99",
		},
	}

	var rawMessages []json.RawMessage
	for _, row := range sampleRows {
		b, _ := json.Marshal(row)
		rawMessages = append(rawMessages, b)
	}

	mockClient := &mockSodaClient{records: rawMessages}
	service := NewProductSyncService(db, mockClient)

	// 4. Ejecutar sincronización
	res, err := service.SyncProducts(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 2, res.RecordsProcessed, "debe procesar 2 registros y omitir el del programa fantasma 9999")
	assert.Equal(t, "SUCCESS", res.Status)

	// 5. Verificar que 0101001 actualizó datos pero conservó observaciones
	var updated models.CatalogProduct
	err = db.Where("codigo_producto = ? AND codigo_indicador_producto = ?", "0101001", "IND01").First(&updated).Error
	require.NoError(t, err)
	assert.Equal(t, "Asistencia Técnica Agropecuaria Integral", updated.Producto)
	assert.Equal(t, "Acompañamiento a pequeños productores", updated.Descripcion)
	assert.Equal(t, &progID, updated.ProgramID, "debe resolver la FK hacia ProgramID")
	assert.True(t, updated.EsNacional)
	assert.True(t, updated.EsTerritorial)
	assert.Equal(t, "Notas internas confidenciales - NO MODIFICAR EN SYNC", updated.Observaciones, "las observaciones deben estar protegidas y no sobreescribirse")

	// 6. Verificar inserción del nuevo producto
	var newProd models.CatalogProduct
	err = db.Where("codigo_producto = ? AND codigo_indicador_producto = ?", "0101002", "IND02").First(&newProd).Error
	require.NoError(t, err)
	assert.Equal(t, "Crédito de Fomento Rural", newProd.Producto)
	assert.Equal(t, &progID, newProd.ProgramID)
	assert.True(t, newProd.EsNacional)

	// 7. Verificar que el producto fantasma no fue insertado
	var countGhost int64
	db.Model(&models.CatalogProduct{}).Where("codigo_producto = ?", "9999001").Count(&countGhost)
	assert.Equal(t, int64(0), countGhost)

	// 8. Verificar log de auditoría
	status, err := service.GetLatestSyncStatus(context.Background(), "PRODUCTS")
	require.NoError(t, err)
	require.NotNil(t, status)
	assert.Equal(t, models.CatalogSyncStatus("SUCCESS"), status.Status)
	assert.Equal(t, 2, status.RecordsProcessed)
	assert.Equal(t, "PRODUCTS", status.CatalogName)
}

func TestProductSyncService_SyncProducts_FailureHandling(t *testing.T) {
	db := newProductTestDB(t)

	mockClient := &mockSodaClient{err: errors.New("soda products endpoint timeout")}
	service := NewProductSyncService(db, mockClient)

	res, err := service.SyncProducts(context.Background())
	require.Error(t, err)
	assert.Nil(t, res)

	status, err := service.GetLatestSyncStatus(context.Background(), "PRODUCTS")
	require.NoError(t, err)
	require.NotNil(t, status)
	assert.Equal(t, models.CatalogSyncStatus("FAILED"), status.Status)
	assert.Contains(t, status.ErrorMessage, "soda products endpoint timeout")
}
