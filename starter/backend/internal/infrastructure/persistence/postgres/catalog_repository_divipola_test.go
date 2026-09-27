package postgres

import (
	"context"
	"testing"

	"aurora-backend/internal/domain/models"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupDivipolaTestDB(t *testing.T) (*gorm.DB, *CatalogRepository) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:divipola_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	err = db.AutoMigrate(&models.Department{}, &models.Municipality{})
	require.NoError(t, err)

	repo := NewCatalogRepository(db)
	return db, repo
}

func TestCatalogRepository_Divipola(t *testing.T) {
	db, repo := setupDivipolaTestDB(t)
	ctx := context.Background()

	dep := models.Department{Code: "11", Name: "Bogotá D.C."}
	err := db.Create(&dep).Error
	require.NoError(t, err)

	mun1 := models.Municipality{Code: "11001", Name: "Bogotá", DepartmentID: dep.ID}
	mun2 := models.Municipality{Code: "11002", Name: "Suba", DepartmentID: dep.ID}
	err = db.Create(&mun1).Error
	require.NoError(t, err)
	err = db.Create(&mun2).Error
	require.NoError(t, err)

	deps, err := repo.ListDepartments(ctx)
	assert.NoError(t, err)
	assert.Len(t, deps, 1)
	assert.Equal(t, "11", deps[0].Code)

	muns, err := repo.ListMunicipalities(ctx, dep.ID)
	assert.NoError(t, err)
	assert.Len(t, muns, 2)

	munsAll, err := repo.ListMunicipalities(ctx, 0)
	assert.NoError(t, err)
	assert.Len(t, munsAll, 2)
}
