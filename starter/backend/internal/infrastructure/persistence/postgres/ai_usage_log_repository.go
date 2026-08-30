package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AiUsageLogAuditRow fila de telemetría IA enriquecida con email de usuario y tenant.
type AiUsageLogAuditRow struct {
	ID         uuid.UUID `gorm:"column:id"`
	UserID     uuid.UUID `gorm:"column:user_id"`
	Role       string    `gorm:"column:role"`
	Action     string    `gorm:"column:action"`
	Intent     string    `gorm:"column:intent"`
	Model      string    `gorm:"column:model"`
	CreatedAt  time.Time `gorm:"column:created_at"`
	UserEmail  string    `gorm:"column:user_email"`
	TenantName string    `gorm:"column:tenant_name"`
}

// AiUsageLogRepository lectura paginada de telemetría IA para el panel de auditoría.
type AiUsageLogRepository struct {
	db *gorm.DB
}

func NewAiUsageLogRepository(db *gorm.DB) *AiUsageLogRepository {
	return &AiUsageLogRepository{db: db}
}

func (r *AiUsageLogRepository) ListPaginated(ctx context.Context, page, pageSize int) ([]AiUsageLogAuditRow, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	base := r.db.WithContext(ctx).Table("ai_usage_logs AS l")

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []AiUsageLogAuditRow
	err := base.
		Select(`l.id, l.user_id, l.role, l.action, l.intent, l.model, l.created_at,
			COALESCE(u.email, '') AS user_email,
			COALESCE(t.name, '') AS tenant_name`).
		Joins("LEFT JOIN users u ON u.id = l.user_id AND u.deleted_at IS NULL").
		Joins("LEFT JOIN tenants t ON t.id = u.tenant_id AND t.deleted_at IS NULL").
		Order("l.created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Scan(&rows).Error
	return rows, total, err
}
