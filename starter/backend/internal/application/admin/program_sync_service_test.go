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

func newProgramTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:program_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.CatalogSyncLog{}, &models.Sector{}, &models.ProgramSubprogram{}))
	return db
}

func TestProgramSyncService_SyncPrograms_ResolvesSectorFKAndProtectedUpsert(t *testing.T) {
	db := newProgramTestDB(t)

	assert.Equal(t, "programas_subprogramas", models.ProgramSubprogram{}.TableName())

	// 1. Crear Sectores base en DB
	sector1 := models.Sector{
		ID:        uuid.New(),
		Code:      "01",
		Name:      "Agricultura y Desarrollo Rural",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	sector2 := models.Sector{
		ID:        uuid.New(),
		Code:      "02",
		Name:      "Salud y Protección Social",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, db.Create(&sector1).Error)
	require.NoError(t, db.Create(&sector2).Error)

	// 2. Pre-insertar un programa con observaciones personalizadas para verificar que no se sobreescriban
	existingProg := models.ProgramSubprogram{
		ID:                uuid.New(),
		SectorID:          sector1.ID,
		CodigoSector:      "01",
		NombreSector:      "Agricultura y Desarrollo Rural",
		CodigoPrograma:    "0101",
		NombrePrograma:    "Nombre Original Programa",
		AmbitoAplicacion:  "Nacional",
		CodigoSubprograma: "010101",
		NombreSubprograma: "Subprograma Original",
		Observaciones:     "Notas confidenciales del plan territorial - PROTEGER",
		CreatedAt:         time.Now().Add(-2 * time.Hour),
	}
	require.NoError(t, db.Create(&existingProg).Error)

	// 3. Mockear datos provenientes de SODA:
	// - Uno que actualiza 0101 (debe preservar observaciones)
	// - Uno nuevo bajo sector 02
	// - Uno con sector inexistente 99 (debe ser omitido para mantener FK integrity)
	sampleRows := []RawSodaProgramRow{
		{
			CodigoSector:      "01",
			CodigoPrograma:    "0101",
			NombrePrograma:    "Inclusión Productiva de Pequeños Productores",
			CodigoSubprograma: "010101",
			NombreSubprograma: "Acceso a Tierras y Riego",
			AmbitoAplicacion:  "Territorial y Nacional",
		},
		{
			CodigoSector:      "02",
			CodigoPrograma:    "0201",
			NombrePrograma:    "Atención Primaria en Salud",
			CodigoSubprograma: "020101",
			NombreSubprograma: "Salud Rural Dispersa",
			AmbitoAplicacion:  "Nacional",
		},
		{
			CodigoSector:      "99", // No existe en la base de datos
			CodigoPrograma:    "9901",
			NombrePrograma:    "Sector Fantasma",
			CodigoSubprograma: "990101",
		},
	}

	var data []map[string]interface{}
	for _, row := range sampleRows {
		b, _ := json.Marshal(row)
		var item map[string]interface{}
		_ = json.Unmarshal(b, &item)
		data = append(data, item)
	}

	service := NewProgramSyncService(db)

	// 4. Ejecutar Sync
	res, err := service.SyncPrograms(context.Background(), data)
	require.NoError(t, err)
	assert.Equal(t, 2, res.RecordsProcessed, "debe procesar 2 registros y omitir el del sector inexistente 99")
	assert.Equal(t, "SUCCESS", res.Status)

	// 5. Verificar que 0101 actualizó datos pero conservó observaciones
	var updated0101 models.ProgramSubprogram
	err = db.Where("codigo_programa = ? AND codigo_subprograma = ?", "0101", "010101").First(&updated0101).Error
	require.NoError(t, err)
	assert.Equal(t, "Inclusión Productiva de Pequeños Productores", updated0101.NombrePrograma)
	assert.Equal(t, "Acceso a Tierras y Riego", updated0101.NombreSubprograma)
	assert.Equal(t, sector1.ID, updated0101.SectorID, "debe resolver correctamente la FK de SectorID")
	assert.Equal(t, "Notas confidenciales del plan territorial - PROTEGER", updated0101.Observaciones, "las observaciones deben estar protegidas y no sobreescribirse")

	// 6. Verificar que 0201 fue insertado correctamente con su SectorID resuelto
	var new0201 models.ProgramSubprogram
	err = db.Where("codigo_programa = ? AND codigo_subprograma = ?", "0201", "020101").First(&new0201).Error
	require.NoError(t, err)
	assert.Equal(t, "Atención Primaria en Salud", new0201.NombrePrograma)
	assert.Equal(t, sector2.ID, new0201.SectorID)
	assert.Equal(t, "Salud y Protección Social", new0201.NombreSector)

	// 7. Verificar que el programa fantasma no fue insertado
	var countGhost int64
	db.Model(&models.ProgramSubprogram{}).Where("codigo_programa = ?", "9901").Count(&countGhost)
	assert.Equal(t, int64(0), countGhost)

	// 8. Verificar log de auditoría
	status, err := service.GetLatestSyncStatus(context.Background(), "PROGRAMS")
	require.NoError(t, err)
	require.NotNil(t, status)
	assert.Equal(t, models.CatalogSyncStatus("SUCCESS"), status.Status)
	assert.Equal(t, 2, status.RecordsProcessed)
	assert.Equal(t, "PROGRAMS", status.CatalogName)
}

func TestProgramSyncService_SyncPrograms_FailureHandling(t *testing.T) {
	db := newProgramTestDB(t)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, sqlDB.Close())

	service := NewProgramSyncService(db)

	res, err := service.SyncPrograms(context.Background(), []map[string]interface{}{{"codigo_programa": "0101"}})
	require.Error(t, err)
	assert.Nil(t, res)

	assert.Contains(t, err.Error(), "closed")
}
