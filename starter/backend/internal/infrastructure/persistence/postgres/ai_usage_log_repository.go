package postgres

import (
	"context"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
)

// AiUsageLogRepository lectura paginada de telemetría IA para el panel de auditoría.
type AiUsageLogRepository struct {
	db *gorm.DB
}

func NewAiUsageLogRepository(db *gorm.DB) *AiUsageLogRepository {
	return &AiUsageLogRepository{db: db}
}

func (r *AiUsageLogRepository) ListPaginated(ctx context.Context, page, pageSize int) ([]models.AiUsageLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int64
	if err := r.db.WithContext(ctx).Model(&models.AiUsageLog{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []models.AiUsageLog
	err := r.db.WithContext(ctx).
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&rows).Error
	return rows, total, err
}
