package models

import (
	"time"

	"github.com/google/uuid"
)

// AILog registra cada mensaje del asistente IA (auditoría por tenant).
// Role: "user" | "assistant"
type AILog struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID   uuid.UUID  `gorm:"type:uuid;not null;index" json:"tenant_id"`
	UserID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	ProjectID  *uuid.UUID `gorm:"type:uuid;index" json:"project_id,omitempty"`
	Role       string     `gorm:"type:varchar(20);not null;index" json:"role"`
	Content    string     `gorm:"type:text;not null" json:"content"`
	Model      string     `gorm:"type:varchar(100)" json:"model,omitempty"`
	TokensUsed int        `gorm:"not null;default:0" json:"tokens_used"`
	Metadata   *string    `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt  time.Time  `gorm:"not null;index" json:"created_at"`

	Tenant  Tenant   `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	User    User     `gorm:"foreignKey:UserID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"-"`
}

func (AILog) TableName() string {
	return "ai_logs"
}
