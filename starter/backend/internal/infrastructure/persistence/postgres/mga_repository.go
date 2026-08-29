package postgres

import (
	"context"
	"errors"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type MgaRepository struct {
	db *gorm.DB
}

func NewMgaRepository(db *gorm.DB) *MgaRepository {
	return &MgaRepository{db: db}
}

func (r *MgaRepository) ListCauses(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.MgaCause, error) {
	causes := make([]models.MgaCause, 0)
	err := r.db.WithContext(ctx).
		Preload("SpecificObjective").
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("sort_order ASC, created_at ASC").
		Find(&causes).Error
	return causes, err
}

func (r *MgaRepository) FindCause(ctx context.Context, causeID, projectID, tenantID uuid.UUID) (*models.MgaCause, error) {
	var cause models.MgaCause
	err := r.db.WithContext(ctx).
		Preload("SpecificObjective").
		Where("id = ? AND project_id = ? AND tenant_id = ?", causeID, projectID, tenantID).
		First(&cause).Error
	if err != nil {
		return nil, err
	}
	return &cause, nil
}

func (r *MgaRepository) CreateCause(ctx context.Context, cause *models.MgaCause, objective *models.MgaSpecificObjective) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(cause).Error; err != nil {
			return err
		}
		if objective != nil {
			objective.CauseID = cause.ID
			objective.TenantID = cause.TenantID
			objective.ProjectID = cause.ProjectID
			if err := tx.Create(objective).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *MgaRepository) UpdateCause(ctx context.Context, cause *models.MgaCause) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaCause{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", cause.ID, cause.ProjectID, cause.TenantID).
		Select("cause_type", "description", "parent_id", "sort_order", "updated_at").
		Updates(cause).Error
}

func (r *MgaRepository) DeleteCause(ctx context.Context, causeID, projectID, tenantID uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("cause_id = ? AND project_id = ? AND tenant_id = ?", causeID, projectID, tenantID).
			Delete(&models.MgaSpecificObjective{}).Error; err != nil {
			return err
		}
		result := tx.Where("id = ? AND project_id = ? AND tenant_id = ?", causeID, projectID, tenantID).
			Delete(&models.MgaCause{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (r *MgaRepository) FindObjective(ctx context.Context, objectiveID, projectID, tenantID uuid.UUID) (*models.MgaSpecificObjective, error) {
	var objective models.MgaSpecificObjective
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", objectiveID, projectID, tenantID).
		First(&objective).Error
	if err != nil {
		return nil, err
	}
	return &objective, nil
}

func (r *MgaRepository) UpdateObjective(ctx context.Context, objective *models.MgaSpecificObjective) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaSpecificObjective{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", objective.ID, objective.ProjectID, objective.TenantID).
		Select("description", "updated_at").
		Updates(objective).Error
}

func (r *MgaRepository) CreateObjective(ctx context.Context, objective *models.MgaSpecificObjective) error {
	return r.db.WithContext(ctx).Create(objective).Error
}

func (r *MgaRepository) DeleteObjective(ctx context.Context, objectiveID, projectID, tenantID uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", objectiveID, projectID, tenantID).
		Delete(&models.MgaSpecificObjective{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *MgaRepository) ListIndicators(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.MgaIndicator, error) {
	indicators := make([]models.MgaIndicator, 0)
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("sort_order ASC, created_at ASC").
		Find(&indicators).Error
	return indicators, err
}

func (r *MgaRepository) FindIndicator(ctx context.Context, indicatorID, projectID, tenantID uuid.UUID) (*models.MgaIndicator, error) {
	var indicator models.MgaIndicator
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", indicatorID, projectID, tenantID).
		First(&indicator).Error
	if err != nil {
		return nil, err
	}
	return &indicator, nil
}

func (r *MgaRepository) CreateIndicator(ctx context.Context, indicator *models.MgaIndicator) error {
	return r.db.WithContext(ctx).Create(indicator).Error
}

func (r *MgaRepository) UpdateIndicator(ctx context.Context, indicator *models.MgaIndicator) error {
	return r.db.WithContext(ctx).
		Model(&models.MgaIndicator{}).
		Where("id = ? AND project_id = ? AND tenant_id = ?", indicator.ID, indicator.ProjectID, indicator.TenantID).
		Select("name", "unit", "target", "source_type", "verification_source", "specific_objective_id", "sort_order", "updated_at").
		Updates(indicator).Error
}

func (r *MgaRepository) DeleteIndicator(ctx context.Context, indicatorID, projectID, tenantID uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ? AND tenant_id = ?", indicatorID, projectID, tenantID).
		Delete(&models.MgaIndicator{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func IsMgaNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
