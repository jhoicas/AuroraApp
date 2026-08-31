package postgres

import (
	"context"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

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
