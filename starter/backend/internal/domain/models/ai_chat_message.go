package models

import (
	"time"

	"github.com/google/uuid"
)

// AiChatMessage historial transaccional del Aurora Copilot.
type AiChatMessage struct {
	ID           uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID       uuid.UUID  `gorm:"column:user_id;type:uuid;not null;index" json:"user_id"`
	TenantID     *uuid.UUID `gorm:"column:tenant_id;type:uuid;index" json:"tenant_id,omitempty"`
	SessionID    string     `gorm:"column:session_id;type:varchar(64);not null;index" json:"session_id"`
	Role         string     `gorm:"column:role;type:varchar(20);not null" json:"role"`
	Content      string     `gorm:"column:content;type:text;not null" json:"content"`
	Model        string     `gorm:"column:model;type:varchar(100)" json:"model,omitempty"`
	ActionCards  string     `gorm:"column:action_cards;type:jsonb;default:'[]'" json:"action_cards"`
	RouteContext string     `gorm:"column:route_context;type:varchar(4000)" json:"route_context,omitempty"`
	CreatedAt    time.Time  `gorm:"column:created_at;not null;index" json:"created_at"`
}

func (AiChatMessage) TableName() string {
	return "ai_chat_messages"
}

const (
	ChatRoleUser      = "user"
	ChatRoleAssistant = "assistant"
)
