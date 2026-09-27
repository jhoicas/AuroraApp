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

func setupPndTestDB(t *testing.T) (*gorm.DB, *CatalogRepository) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:pnd_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	require.NoError(t, db.AutoMigrate(&models.PNDCatalog{}))
	repo := NewCatalogRepository(db)
	return db, repo
}

func TestCatalogPnd_SearchAndPagination(t *testing.T) {
	db, repo := setupPndTestDB(t)
	ctx := context.Background()

	planA := "Plan Nacional de Desarrollo 2022-2026"
	planB := "Plan Territorial 2024"

	items := []models.PNDCatalog{
		{
			ID:                   1,
			PlanName:             &planA,
			PillarDescription:    "Ordenamiento del territorio alrededor del agua",
			ObjectiveDescription: "Justicia ambiental y gobernanza del agua",
			StrategyDescription:  "Restauración ecológica de cuencas hidrográficas",
			ComponentDescription: "Protección de páramos y humedales",
			CreatedAt:            time.Now(),
		},
		{
			ID:                   2,
			PlanName:             &planA,
			PillarDescription:    "Seguridad humana y justicia social",
			ObjectiveDescription: "Garantía del derecho humano a la alimentación",
			StrategyDescription:  "Producción agropecuaria sostenible y soberanía alimentaria",
			ComponentDescription: "Apoyo a la agricultura campesina, familiar y comunitaria",
			CreatedAt:            time.Now(),
		},
		{
			ID:                   3,
			PlanName:             &planB,
			PillarDescription:    "Transformación productiva, internacionalización y acción climática",
			ObjectiveDescription: "Transición energética justa",
			StrategyDescription:  "Desarrollo de energías renovables no convencionales",
			ComponentDescription: "Comunidades energéticas solares",
			CreatedAt:            time.Now(),
		},
	}

	for _, item := range items {
		require.NoError(t, db.Create(&item).Error)
	}

	tests := []struct {
		name          string
		search        string
		expectedTotal int64
		expectedCount int
		expectedID    uint
	}{
		{
			name:          "Buscar por plan_name (Territorial)",
			search:        "Territorial",
			expectedTotal: 1,
			expectedCount: 1,
			expectedID:    3,
		},
		{
			name:          "Buscar por pillar_description (alrededor del agua)",
			search:        "alrededor del agua",
			expectedTotal: 1,
			expectedCount: 1,
			expectedID:    1,
		},
		{
			name:          "Buscar por objective_description (alimentación)",
			search:        "alimentación",
			expectedTotal: 1,
			expectedCount: 1,
			expectedID:    2,
		},
		{
			name:          "Buscar por strategy_description (agropecuaria)",
			search:        "Agropecuaria",
			expectedTotal: 1,
			expectedCount: 1,
			expectedID:    2,
		},
		{
			name:          "Buscar por component_description (páramos)",
			search:        "páramos",
			expectedTotal: 1,
			expectedCount: 1,
			expectedID:    1,
		},
		{
			name:          "Búsqueda sin coincidencias",
			search:        "inexistentexyz",
			expectedTotal: 0,
			expectedCount: 0,
			expectedID:    0,
		},
		{
			name:          "Búsqueda vacía devuelve todos los registros",
			search:        "",
			expectedTotal: 3,
			expectedCount: 3,
			expectedID:    0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := repo.ListPndCatalogs(ctx, PndListParams{
				Page:   1,
				Limit:  10,
				Search: tt.search,
			})
			require.NoError(t, err)
			assert.Equal(t, tt.expectedTotal, res.Total, "El Total en la metadata debe reflejar el conteo filtrado")
			assert.Equal(t, tt.expectedCount, len(res.Items))
			if tt.expectedID != 0 && len(res.Items) > 0 {
				assert.Equal(t, tt.expectedID, res.Items[0].ID)
			}
		})
	}
}
