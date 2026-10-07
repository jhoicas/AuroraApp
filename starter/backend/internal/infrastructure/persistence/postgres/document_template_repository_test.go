package postgres

import (
	"context"
	"testing"

	"aurora-backend/internal/domain/models"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newTemplateTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:tpl_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.DocumentTemplate{}))
	return db
}

func TestActivateDeactivatesOthersOfSameTenantOnly(t *testing.T) {
	db := newTemplateTestDB(t)
	repo := NewDocumentTemplateRepository(db)
	ctx := context.Background()
	tenantA, tenantB := uuid.New(), uuid.New()

	a1, err := repo.Create(ctx, tenantA, "A1", "<p>1</p>", nil)
	require.NoError(t, err)
	a2, err := repo.Create(ctx, tenantA, "A2", "<p>2</p>", nil)
	require.NoError(t, err)
	b1, err := repo.Create(ctx, tenantB, "B1", "<p>b</p>", nil)
	require.NoError(t, err)

	_, err = repo.Activate(ctx, tenantA, a1.ID)
	require.NoError(t, err)
	_, err = repo.Activate(ctx, tenantB, b1.ID)
	require.NoError(t, err)
	_, err = repo.Activate(ctx, tenantA, a2.ID)
	require.NoError(t, err)

	active := func(id uuid.UUID) bool {
		var tpl models.DocumentTemplate
		require.NoError(t, db.First(&tpl, "id = ?", id).Error)
		return tpl.IsActive
	}
	require.False(t, active(a1.ID), "A1 debe quedar inactiva")
	require.True(t, active(a2.ID))
	require.True(t, active(b1.ID), "otro tenant no se toca")

	var count int64
	db.Model(&models.DocumentTemplate{}).Where("tenant_id = ? AND is_active = ?", tenantA, true).Count(&count)
	require.EqualValues(t, 1, count)
}

func TestActivateSystemTemplateClonesIt(t *testing.T) {
	db := newTemplateTestDB(t)
	require.NoError(t, EnsureDocumentTemplatesSeed(db))
	require.NoError(t, EnsureDocumentTemplatesSeed(db)) // idempotente
	repo := NewDocumentTemplateRepository(db)
	ctx := context.Background()
	tenant := uuid.New()

	list, err := repo.List(ctx, tenant)
	require.NoError(t, err)
	require.Len(t, list, len(systemDocumentTemplates))

	got, err := repo.Activate(ctx, tenant, list[0].ID)
	require.NoError(t, err)
	require.NotNil(t, got.TenantID)
	require.True(t, got.IsActive)
	require.NotEqual(t, list[0].ID, got.ID)

	var sys models.DocumentTemplate
	require.NoError(t, db.First(&sys, "id = ?", list[0].ID).Error)
	require.False(t, sys.IsActive, "la global nunca se activa")
}

func TestResolveFallsBackToSystemDefault(t *testing.T) {
	db := newTemplateTestDB(t)
	repo := NewDocumentTemplateRepository(db)
	ctx := context.Background()
	tenant := uuid.New()

	_, err := repo.Resolve(ctx, tenant)
	require.ErrorIs(t, err, ErrTemplateNotFound)

	require.NoError(t, EnsureDocumentTemplatesSeed(db))
	own, err := repo.Create(ctx, tenant, "Mía", "<p>x</p>", nil) // inactiva
	require.NoError(t, err)

	got, err := repo.Resolve(ctx, tenant)
	require.NoError(t, err)
	require.True(t, got.IsSystemDefault, "sin activa ⇒ plantilla global")
	require.Nil(t, got.TenantID)

	_, err = repo.Activate(ctx, tenant, own.ID)
	require.NoError(t, err)
	got, err = repo.Resolve(ctx, tenant)
	require.NoError(t, err)
	require.Equal(t, own.ID, got.ID)

	other, err := repo.Resolve(ctx, uuid.New())
	require.NoError(t, err)
	require.True(t, other.IsSystemDefault, "plantilla activa de otro tenant no aplica")
}

func TestSystemTemplateReadOnlyAndTenantIsolation(t *testing.T) {
	db := newTemplateTestDB(t)
	require.NoError(t, EnsureDocumentTemplatesSeed(db))
	repo := NewDocumentTemplateRepository(db)
	ctx := context.Background()
	tenantA, tenantB := uuid.New(), uuid.New()

	list, _ := repo.List(ctx, tenantA)
	html := "<p>hack</p>"
	_, err := repo.Update(ctx, tenantA, list[0].ID, nil, &html)
	require.ErrorIs(t, err, ErrTemplateReadOnly)

	own, err := repo.Create(ctx, tenantA, "Clon", "", &list[0].ID)
	require.NoError(t, err)
	require.NotEmpty(t, own.HTMLContent, "clona el HTML de la global")

	_, err = repo.Get(ctx, tenantB, own.ID)
	require.ErrorIs(t, err, ErrTemplateNotFound)
	_, err = repo.Activate(ctx, tenantB, own.ID)
	require.ErrorIs(t, err, ErrTemplateNotFound)
	_, err = repo.Update(ctx, tenantB, own.ID, nil, &html)
	require.ErrorIs(t, err, ErrTemplateNotFound)
}

func TestEnsureDocumentTemplatesSchema_CreatesTableThenSeedRuns(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:dtschema_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	// Sin tabla, el seed falla igual que en producción (42P01).
	require.Error(t, EnsureDocumentTemplatesSeed(db))

	require.NoError(t, EnsureDocumentTemplatesSchema(db))
	require.True(t, db.Migrator().HasTable(&models.DocumentTemplate{}))
	require.NoError(t, EnsureDocumentTemplatesSeed(db))

	var n int64
	require.NoError(t, db.Model(&models.DocumentTemplate{}).Where("is_system_default = ? AND tenant_id IS NULL", true).Count(&n).Error)
	require.Positive(t, n)
	// Idempotente.
	require.NoError(t, EnsureDocumentTemplatesSeed(db))
	var again int64
	require.NoError(t, db.Model(&models.DocumentTemplate{}).Where("is_system_default = ?", true).Count(&again).Error)
	require.Equal(t, n, again)
}

func TestDocumentTemplatesFallbackDDL_MatchesModel(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:dtddl_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	for _, stmt := range documentTemplatesSchemaSQL {
		require.NoError(t, db.Exec(stmt).Error, stmt)
	}
	require.NoError(t, EnsureDocumentTemplatesSeed(db), "el seed funciona sobre el esquema de respaldo")
}

func TestDeleteOwnTemplateSoftDeletesAndBlocksSystem(t *testing.T) {
	db := newTemplateTestDB(t)
	require.NoError(t, EnsureDocumentTemplatesSeed(db))
	repo := NewDocumentTemplateRepository(db)
	ctx := context.Background()
	tenant := uuid.New()

	list, err := repo.List(ctx, tenant)
	require.NoError(t, err)
	require.ErrorIs(t, repo.Delete(ctx, tenant, list[0].ID), ErrTemplateReadOnly)

	own, err := repo.Create(ctx, tenant, "Mía", "<p>x</p>", nil)
	require.NoError(t, err)
	require.ErrorIs(t, repo.Delete(ctx, uuid.New(), own.ID), ErrTemplateNotFound)
	require.NoError(t, repo.Delete(ctx, tenant, own.ID))
	_, err = repo.Get(ctx, tenant, own.ID)
	require.ErrorIs(t, err, ErrTemplateNotFound)

	var n int64
	require.NoError(t, db.Unscoped().Model(&models.DocumentTemplate{}).Where("id = ?", own.ID).Count(&n).Error)
	require.EqualValues(t, 1, n, "borrado lógico")
}
