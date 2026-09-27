package postgres

import (
	"context"
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

func setupEdtTestDB(t *testing.T) (*gorm.DB, *CatalogRepository) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:edt_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	require.NoError(t, db.AutoMigrate(&models.CatalogProduct{}, &models.CatalogEdt{}))
	repo := NewCatalogRepository(db)
	return db, repo
}

func TestCatalogEdt_SearchByEdtAndParentProduct(t *testing.T) {
	db, repo := setupEdtTestDB(t)
	ctx := context.Background()

	// 1. Crear producto padre
	prodID := uuid.New()
	parentProduct := models.CatalogProduct{
		ID:                      prodID,
		CodigoProducto:          "0406016",
		Code:                    "0406016",
		Producto:                "Servicio de Educación Inicial",
		Nombre:                  "Servicio de Educación Inicial",
		Sector:                  "04",
		NombreSector:            "Educación",
		CodigoPrograma:          "0406",
		NombrePrograma:          "Educación Inicial",
		CodigoIndicadorProducto: "IND-01",
		CreatedAt:               time.Now(),
	}
	require.NoError(t, db.Create(&parentProduct).Error)

	// 2. Crear registros EDT
	edt1 := models.CatalogEdt{
		ID:                          uuid.New(),
		ProductID:                   &prodID,
		CodigoProductoEstandarizado: "0406016",
		NombreProducto:              "Servicio de Educación Inicial",
		CodigoEntregableL1:          "ENT-L1-EDU",
		NombreEntregableL1:          "Aulas construidas",
		CodigoEntregableL2:          "ENT-L2-EDU",
		NombreEntregableL2:          "Módulos educativos",
		CodigoEntregableL3:          "ENT-L3-EDU",
		NombreEntregableL3:          "Dotación pedagógica",
		CodigoActividad:             "ACT-777",
		Actividad:                   "Capacitación de docentes rurales",
		DescripcionActividad:        "Capacitación de docentes rurales en pedagogía activa",
		UnidadDeMedida:              "Número",
		CreatedAt:                   time.Now(),
	}

	prodID2 := uuid.New()
	parentProduct2 := models.CatalogProduct{
		ID:                      prodID2,
		CodigoProducto:          "0302005",
		Code:                    "0302005",
		Producto:                "Vía Terciaria Pavimentada",
		Nombre:                  "Vía Terciaria Pavimentada",
		Sector:                  "03",
		NombreSector:            "Transporte",
		CodigoPrograma:          "0302",
		NombrePrograma:          "Infraestructura Vial",
		CodigoIndicadorProducto: "IND-02",
		CreatedAt:               time.Now(),
	}
	require.NoError(t, db.Create(&parentProduct2).Error)

	edt2 := models.CatalogEdt{
		ID:                          uuid.New(),
		ProductID:                   &prodID2,
		CodigoProductoEstandarizado: "0302005",
		NombreProducto:              "", // Intencionalmente vacío para probar fallback a cp.producto
		CodigoEntregableL1:          "ENT-L1-VIA",
		NombreEntregableL1:          "Kilómetros mejorados",
		CodigoEntregableL2:          "ENT-L2-VIA",
		NombreEntregableL2:          "Obras de drenaje",
		CodigoEntregableL3:          "ENT-L3-VIA",
		NombreEntregableL3:          "Cunetas en concreto",
		CodigoActividad:             "ACT-999",
		Actividad:                   "Pavimentación asfáltica",
		DescripcionActividad:        "Pavimentación en mezcla densa en caliente",
		UnidadDeMedida:              "Kilómetro",
		CreatedAt:                   time.Now(),
	}

	require.NoError(t, db.Create(&edt1).Error)
	require.NoError(t, db.Create(&edt2).Error)

	tests := []struct {
		name          string
		search        string
		expectedCount int
		expectedCode  string
	}{
		{
			name:          "Buscar por codigo_producto_estandarizado",
			search:        "0406016",
			expectedCount: 1,
			expectedCode:  "0406016",
		},
		{
			name:          "Buscar por codigo_actividad",
			search:        "ACT-777",
			expectedCount: 1,
			expectedCode:  "0406016",
		},
		{
			name:          "Buscar por actividad",
			search:        "docentes rurales",
			expectedCount: 1,
			expectedCode:  "0406016",
		},
		{
			name:          "Buscar por descripcion_actividad",
			search:        "pedagogía activa",
			expectedCount: 1,
			expectedCode:  "0406016",
		},
		{
			name:          "Buscar por codigo_entregable_l1",
			search:        "ENT-L1-EDU",
			expectedCount: 1,
			expectedCode:  "0406016",
		},
		{
			name:          "Buscar por codigo_entregable_l2",
			search:        "ENT-L2-EDU",
			expectedCount: 1,
			expectedCode:  "0406016",
		},
		{
			name:          "Buscar por codigo_entregable_l3",
			search:        "ENT-L3-EDU",
			expectedCount: 1,
			expectedCode:  "0406016",
		},
		{
			name:          "Buscar por nombre del producto padre (Vía Terciaria)",
			search:        "Vía Terciaria",
			expectedCount: 1,
			expectedCode:  "0302005",
		},
		{
			name:          "Buscar por código del producto padre (0302005)",
			search:        "0302005",
			expectedCount: 1,
			expectedCode:  "0302005",
		},
		{
			name:          "Búsqueda sin coincidencias",
			search:        "inmueble inexistente 12345",
			expectedCount: 0,
			expectedCode:  "",
		},
		{
			name:          "Búsqueda vacía devuelve todos",
			search:        "",
			expectedCount: 2,
			expectedCode:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := repo.ListCatalogEdt(ctx, CatalogEdtListParams{
				Page:   1,
				Limit:  10,
				Search: tt.search,
			})
			require.NoError(t, err)
			assert.Equal(t, int64(tt.expectedCount), res.Total)
			assert.Equal(t, tt.expectedCount, len(res.Items))
			if tt.expectedCode != "" && len(res.Items) > 0 {
				assert.Equal(t, tt.expectedCode, res.Items[0].CodigoProductoEstandarizado)
			}
			// Verificar fallback de nombre de producto cuando catalogo_edt.nombre_producto estaba vacío
			for _, item := range res.Items {
				if item.CodigoProductoEstandarizado == "0302005" {
					assert.Equal(t, "Vía Terciaria Pavimentada", item.NombreProducto)
				}
			}
		})
	}
}
