package postgres

import (
	"context"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProjectEvaluationRepository struct {
	db *gorm.DB
}

func NewProjectEvaluationRepository(db *gorm.DB) *ProjectEvaluationRepository {
	return &ProjectEvaluationRepository{db: db}
}

func (r *ProjectEvaluationRepository) SaveBatch(ctx context.Context, rows []models.ProjectEvaluation) error {
	if len(rows) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Create(&rows).Error
}

func (r *ProjectEvaluationRepository) ListByProject(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.ProjectEvaluation, error) {
	var rows []models.ProjectEvaluation
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("created_at DESC").
		Find(&rows).Error
	return rows, err
}

func (r *ProjectEvaluationRepository) ListLatestByTenant(ctx context.Context, tenantID uuid.UUID, limit int) ([]models.ProjectEvaluation, error) {
	if limit <= 0 {
		limit = 50
	}
	var rows []models.ProjectEvaluation
	err := r.db.WithContext(ctx).
		Where("tenant_id = ?", tenantID).
		Order("created_at DESC").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}
