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

func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:proj_test_"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	ddls := []string{
		`CREATE TABLE projects (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			creator_id TEXT NOT NULL,
			code_bpin TEXT,
			name TEXT NOT NULL,
			description TEXT,
			sector TEXT,
			sector_id TEXT,
			program_code TEXT,
			product_code TEXT,
			problem_description TEXT,
			general_objective TEXT,
			situacion_existente TEXT,
			magnitud_problema TEXT,
			mga_formulation_data TEXT DEFAULT '{}',
			status TEXT NOT NULL DEFAULT 'DRAFT',
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)`,
		`CREATE TABLE mga_causes (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			parent_id TEXT,
			cause_type TEXT NOT NULL,
			description TEXT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)`,
		`CREATE TABLE mga_effects (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			parent_id TEXT,
			effect_type TEXT NOT NULL,
			description TEXT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)`,
		`CREATE TABLE mga_participants (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			actor_id INTEGER NOT NULL,
			actor TEXT NOT NULL DEFAULT '',
			entity_id INTEGER,
			entity TEXT DEFAULT '',
			position_id INTEGER NOT NULL,
			position TEXT NOT NULL DEFAULT '',
			otro_participante TEXT,
			interests TEXT NOT NULL,
			contribution TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)`,
		`CREATE TABLE mga_populations (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			population_type TEXT NOT NULL,
			total_number INTEGER NOT NULL,
			source TEXT NOT NULL,
			locations TEXT NOT NULL DEFAULT '[]',
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)`,
		`CREATE TABLE mga_alternatives (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			description TEXT NOT NULL,
			evaluate_profitability BOOLEAN NOT NULL DEFAULT 0,
			evaluate_cost BOOLEAN NOT NULL DEFAULT 0,
			proceeds_to_preparation BOOLEAN NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)`,
		`CREATE TABLE project_deliverables (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			project_edt_node_id TEXT NOT NULL,
			catalog_deliverable_id TEXT,
			code TEXT NOT NULL,
			name TEXT NOT NULL,
			amount NUMERIC NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)`,
		`CREATE TABLE project_activities (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			project_deliverable_id TEXT NOT NULL,
			catalog_activity_id TEXT,
			code TEXT NOT NULL,
			name TEXT NOT NULL,
			quantity NUMERIC NOT NULL DEFAULT 0,
			unit_cost NUMERIC NOT NULL DEFAULT 0,
			total_cost NUMERIC NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)`,
		`CREATE TABLE budget_items (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			project_id TEXT NOT NULL,
			product_id TEXT,
			description TEXT NOT NULL,
			amount NUMERIC NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME
		)`,
	}

	for _, ddl := range ddls {
		require.NoError(t, db.Exec(ddl).Error)
	}

	return db
}

func TestCalculateProgress_AllMilestones(t *testing.T) {
	db := newTestDB(t)
	repo := NewProjectRepository(db)
	ctx := context.Background()

	tenantID := uuid.New()
	creatorID := uuid.New()
	sectorID := uuid.New()
	projectID := uuid.New()

	// 1. Proyecto vacío (sin name, sin sector, etc.)
	p := models.Project{
		ID:        projectID,
		TenantID:  tenantID,
		CreatorID: creatorID,
		Name:      "",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, db.Create(&p).Error)

	prog, err := repo.CalculateProgress(ctx, projectID)
	require.NoError(t, err)
	assert.Equal(t, 0, prog, "Proyecto vacío debe tener 0% de avance")

	// 2. Hito 1: Datos Básicos (name != "" y sector_id != nil)
	p.Name = "Proyecto Acueducto"
	p.SectorID = &sectorID
	require.NoError(t, db.Save(&p).Error)

	prog, err = repo.CalculateProgress(ctx, projectID)
	require.NoError(t, err)
	assert.Equal(t, 10, prog, "Cumple Hito 1 (10%)")

	// 3. Hito 2: Problema Central (problem_description != "" y situacion_existente != "")
	p.ProblemDescription = "Falta de agua potable"
	p.SituacionExistente = "Comunidad sin acceso a red"
	require.NoError(t, db.Save(&p).Error)

	prog, err = repo.CalculateProgress(ctx, projectID)
	require.NoError(t, err)
	assert.Equal(t, 20, prog, "Cumple Hito 1 y 2 (20%)")

	// 4. Hito 3: Causas (mga_causes >= 1)
	cause := models.MgaCause{
		ID:          uuid.New(),
		TenantID:    tenantID,
		ProjectID:   projectID,
		CauseType:   "directa",
		Description: "Tubería obsoleta",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	require.NoError(t, db.Create(&cause).Error)

	prog, err = repo.CalculateProgress(ctx, projectID)
	require.NoError(t, err)
	assert.Equal(t, 30, prog, "Cumple Hitos 1-3 (30%)")

	// 5. Hito 4: Efectos (mga_effects >= 1)
	effect := models.MgaEffect{
		ID:          uuid.New(),
		TenantID:    tenantID,
		ProjectID:   projectID,
		EffectType:  "directo",
		Description: "Enfermedades gastrointestinales",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	require.NoError(t, db.Create(&effect).Error)

	prog, err = repo.CalculateProgress(ctx, projectID)
	require.NoError(t, err)
	assert.Equal(t, 40, prog, "Cumple Hitos 1-4 (40%)")

	// 6. Hito 5: Participantes (mga_participants >= 1)
	participant := models.MgaParticipant{
		ID:           uuid.New(),
		TenantID:     tenantID,
		ProjectID:    projectID,
		ActorID:      1,
		PositionID:   1,
		Interests:    "Acceso al agua",
		Contribution: "Mano de obra",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	require.NoError(t, db.Create(&participant).Error)

	prog, err = repo.CalculateProgress(ctx, projectID)
	require.NoError(t, err)
	assert.Equal(t, 50, prog, "Cumple Hitos 1-5 (50%)")

	// 7. Hito 6: Población (mga_populations >= 1)
	pop := models.MgaPopulation{
		ID:             uuid.New(),
		TenantID:       tenantID,
		ProjectID:      projectID,
		PopulationType: "objetivo",
		TotalNumber:    5000,
		Source:         "Censo DANE",
		Locations:      "[]",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	require.NoError(t, db.Create(&pop).Error)

	prog, err = repo.CalculateProgress(ctx, projectID)
	require.NoError(t, err)
	assert.Equal(t, 60, prog, "Cumple Hitos 1-6 (60%)")

	// 8. Hito 7: Objetivo General (general_objective != "")
	p.GeneralObjective = "Garantizar el acceso continuo de agua potable"
	require.NoError(t, db.Save(&p).Error)

	prog, err = repo.CalculateProgress(ctx, projectID)
	require.NoError(t, err)
	assert.Equal(t, 70, prog, "Cumple Hitos 1-7 (70%)")

	// 9. Hito 8: Alternativas (mga_alternatives >= 1)
	alt := models.MgaAlternative{
		ID:          uuid.New(),
		TenantID:    tenantID,
		ProjectID:   projectID,
		Description: "Construcción nueva planta de potabilización",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	require.NoError(t, db.Create(&alt).Error)

	prog, err = repo.CalculateProgress(ctx, projectID)
	require.NoError(t, err)
	assert.Equal(t, 80, prog, "Cumple Hitos 1-8 (80%)")

	// 10. Hito 9: Cadena de Valor (project_deliverables o project_activities >= 1)
	nodeID := uuid.New()
	deliverable := models.ProjectDeliverable{
		ID:               uuid.New(),
		TenantID:         tenantID,
		ProjectID:        projectID,
		ProjectEdtNodeID: nodeID,
		Code:             "ENT-01",
		Name:             "Planta potabilizadora",
		Amount:           500000000,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}
	require.NoError(t, db.Create(&deliverable).Error)

	prog, err = repo.CalculateProgress(ctx, projectID)
	require.NoError(t, err)
	assert.Equal(t, 90, prog, "Cumple Hitos 1-9 (90%)")

	// 11. Hito 10: Presupuesto (budget_items >= 1)
	budget := models.BudgetItem{
		ID:          uuid.New(),
		TenantID:    tenantID,
		ProjectID:   projectID,
		Description: "Materiales y tuberías",
		Amount:      350000000,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	require.NoError(t, db.Create(&budget).Error)

	prog, err = repo.CalculateProgress(ctx, projectID)
	require.NoError(t, err)
	assert.Equal(t, 100, prog, "Cumple los 10 hitos (100%)")
}

func TestCalculateProgressForProjects_BatchNoNPlusOne(t *testing.T) {
	db := newTestDB(t)
	repo := NewProjectRepository(db)
	ctx := context.Background()

	tenantID := uuid.New()
	creatorID := uuid.New()
	sectorID := uuid.New()

	// Proyecto A: 10% (solo datos basicos)
	projA := models.Project{
		ID:        uuid.New(),
		TenantID:  tenantID,
		CreatorID: creatorID,
		Name:      "Proyecto A",
		SectorID:  &sectorID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, db.Create(&projA).Error)

	// Proyecto B: 0%
	projB := models.Project{
		ID:        uuid.New(),
		TenantID:  tenantID,
		CreatorID: creatorID,
		Name:      "",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	require.NoError(t, db.Create(&projB).Error)

	progressMap, err := repo.CalculateProgressForProjects(ctx, []uuid.UUID{projA.ID, projB.ID})
	require.NoError(t, err)
	assert.Equal(t, 10, progressMap[projA.ID])
	assert.Equal(t, 0, progressMap[projB.ID])

	// Verificar FindOwnedWithProgress
	foundA, err := repo.FindOwnedWithProgress(ctx, projA.ID, tenantID)
	require.NoError(t, err)
	assert.Equal(t, 10, foundA.Progress)
}
