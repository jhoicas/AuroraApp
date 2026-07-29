package postgres

import (
	"context"
	"time"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AiChatRepository struct {
	db *gorm.DB
}

func NewAiChatRepository(db *gorm.DB) *AiChatRepository {
	return &AiChatRepository{db: db}
}

type ChatMessagePair struct {
	User      models.AiChatMessage
	Assistant models.AiChatMessage
}

func (r *AiChatRepository) SavePair(ctx context.Context, pair ChatMessagePair) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&pair.User).Error; err != nil {
			return err
		}
		return tx.Create(&pair.Assistant).Error
	})
}

func (r *AiChatRepository) ListPaginated(ctx context.Context, page, pageSize int) ([]models.AiChatMessage, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int64
	if err := r.db.WithContext(ctx).Model(&models.AiChatMessage{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []models.AiChatMessage
	err := r.db.WithContext(ctx).
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&rows).Error
	return rows, total, err
}

func (r *AiChatRepository) ListByUser(ctx context.Context, userID uuid.UUID, sessionID string, limit int) ([]models.AiChatMessage, error) {
	if limit <= 0 {
		limit = 50
	}
	q := r.db.WithContext(ctx).Where("user_id = ?", userID)
	if sessionID != "" {
		q = q.Where("session_id = ?", sessionID)
	}
	var rows []models.AiChatMessage
	err := q.Order("created_at ASC").Limit(limit).Find(&rows).Error
	return rows, err
}

func NewChatMessage(userID uuid.UUID, tenantID *uuid.UUID, sessionID, role, content, model, actionCards, route string) models.AiChatMessage {
	return models.AiChatMessage{
		ID:           uuid.New(),
		UserID:       userID,
		TenantID:     tenantID,
		SessionID:    sessionID,
		Role:         role,
		Content:      content,
		Model:        model,
		ActionCards:  actionCards,
		RouteContext: route,
		CreatedAt:    time.Now().UTC(),
	}
}
