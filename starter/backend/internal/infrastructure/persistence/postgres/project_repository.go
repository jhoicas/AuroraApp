package postgres

import (
	"context"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProjectProgressSQL es la expresión SQL optimizada para calcular el porcentaje de avance (0-100)
// evaluando los 10 hitos MGA requeridos:
// 1. Datos Básicos: name != '' AND sector_id IS NOT NULL
// 2. Problema Central: problem_description != '' AND situacion_existente != ''
// 3. Causas: al menos 1 registro en mga_causes
// 4. Efectos: al menos 1 registro en mga_effects
// 5. Participantes: al menos 1 registro en mga_participants
// 6. Población: al menos 1 registro en mga_populations
// 7. Objetivo General: general_objective != ''
// 8. Alternativas: al menos 1 registro en mga_alternatives
// 9. Cadena de Valor: al menos 1 registro en project_deliverables o project_activities
// 10. Presupuesto: al menos 1 registro en budget_items
// Fórmula: (hitos_cumplidos * 100) / 10 = hitos_cumplidos * 10
const ProjectProgressSQL = `(
	(CASE WHEN projects.name IS NOT NULL AND TRIM(projects.name) != '' AND projects.sector_id IS NOT NULL THEN 1 ELSE 0 END) +
	(CASE WHEN projects.problem_description IS NOT NULL AND TRIM(projects.problem_description) != '' AND projects.situacion_existente IS NOT NULL AND TRIM(projects.situacion_existente) != '' THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM mga_causes WHERE mga_causes.project_id = projects.id AND mga_causes.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM mga_effects WHERE mga_effects.project_id = projects.id AND mga_effects.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM mga_participants WHERE mga_participants.project_id = projects.id AND mga_participants.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM mga_populations WHERE mga_populations.project_id = projects.id AND mga_populations.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN projects.general_objective IS NOT NULL AND TRIM(projects.general_objective) != '' THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM mga_alternatives WHERE mga_alternatives.project_id = projects.id AND mga_alternatives.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM project_deliverables WHERE project_deliverables.project_id = projects.id AND project_deliverables.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM project_activities WHERE project_activities.project_id = projects.id AND project_activities.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM budget_items WHERE budget_items.project_id = projects.id AND budget_items.deleted_at IS NULL) THEN 1 ELSE 0 END)
) * 10`

// ProjectWithProgress contiene el modelo de proyecto y su avance calculado.
type ProjectWithProgress struct {
	models.Project
	Progress int `gorm:"column:progress"`
}

// ProjectRepository acceso a proyectos con aislamiento multi-tenant obligatorio.
type ProjectRepository struct {
	db *gorm.DB
}

func NewProjectRepository(db *gorm.DB) *ProjectRepository {
	return &ProjectRepository{db: db}
}

// FindOwned devuelve el proyecto solo si pertenece al tenant indicado.
func (r *ProjectRepository) FindOwned(ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error) {
	var project models.Project
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ?", projectID, tenantID).
		First(&project).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

// FindOwnedWithProgress devuelve el proyecto junto con su porcentaje de avance calculado.
func (r *ProjectRepository) FindOwnedWithProgress(ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error) {
	project, err := r.FindOwned(ctx, projectID, tenantID)
	if err != nil {
		return nil, err
	}
	progress, err := r.CalculateProgress(ctx, projectID)
	if err == nil {
		project.Progress = progress
	}
	return project, nil
}

// UpdateProjectDetails persiste los campos de formulación MGA del proyecto.
func (r *ProjectRepository) UpdateProjectDetails(ctx context.Context, project *models.Project) error {
	return r.db.WithContext(ctx).
		Model(project).
		Select(
			"ProblemDescription",
			"GeneralObjective",
			"SituacionExistente",
			"MagnitudProblema",
			"UpdatedAt",
		).
		Updates(project).Error
}

// CalculateProgress calcula el avance (0-100) para un proyecto específico en BD.
func (r *ProjectRepository) CalculateProgress(ctx context.Context, projectID uuid.UUID) (int, error) {
	var progress int
	err := r.db.WithContext(ctx).
		Table("projects").
		Select(ProjectProgressSQL).
		Where("id = ?", projectID).
		Scan(&progress).Error
	if err != nil {
		return 0, err
	}
	return progress, nil
}

// CalculateProgressForProjects calcula el avance para una lista de IDs de proyectos en una sola consulta optimizada (evitando problema N+1).
func (r *ProjectRepository) CalculateProgressForProjects(ctx context.Context, projectIDs []uuid.UUID) (map[uuid.UUID]int, error) {
	if len(projectIDs) == 0 {
		return make(map[uuid.UUID]int), nil
	}

	type progressResult struct {
		ID       uuid.UUID `gorm:"column:id"`
		Progress int       `gorm:"column:progress"`
	}

	var results []progressResult
	err := r.db.WithContext(ctx).
		Table("projects").
		Select("id, (" + ProjectProgressSQL + ") AS progress").
		Where("id IN ?", projectIDs).
		Scan(&results).Error
	if err != nil {
		return nil, err
	}

	progressMap := make(map[uuid.UUID]int, len(results))
	for _, res := range results {
		progressMap[res.ID] = res.Progress
	}
	return progressMap, nil
}

// ListOwnedWithProgress devuelve proyectos paginados con avance calculado en una sola consulta.
func (r *ProjectRepository) ListOwnedWithProgress(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]ProjectWithProgress, int64, error) {
	var total int64
	base := r.db.WithContext(ctx).Model(&models.Project{}).Where("tenant_id = ?", tenantID)
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var results []ProjectWithProgress
	err := r.db.WithContext(ctx).
		Table("projects").
		Select("projects.*, ("+ProjectProgressSQL+") AS progress").
		Where("projects.tenant_id = ? AND projects.deleted_at IS NULL", tenantID).
		Order("projects.created_at DESC").
		Limit(limit).
		Offset(offset).
		Scan(&results).Error
	if err != nil {
		return nil, 0, err
	}
	return results, total, nil
}
