package models

import (
	"time"

	"github.com/google/uuid"
)

// AiUsageLog telemetría de interacciones con el módulo IA (todos los roles).
type AiUsageLog struct {
	ID        uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"column:user_id;type:uuid;not null;index" json:"user_id"`
	Role      string    `gorm:"column:role;type:varchar(50);not null;index" json:"role"`
	Action    string    `gorm:"column:action;type:varchar(80);not null;index" json:"action"`
	Intent    string    `gorm:"column:intent;type:varchar(40)" json:"intent,omitempty"`
	Model     string    `gorm:"column:model;type:varchar(100)" json:"model,omitempty"`
	CreatedAt time.Time `gorm:"column:created_at;not null;index" json:"created_at"`
}

func (AiUsageLog) TableName() string {
	return "ai_usage_logs"
}

// Acciones de telemetría estándar.
const (
	TelemetryViewGraph  = "view_graph"
	TelemetryIngestXML  = "ingest_xml"
	TelemetryAskCopilot = "ask_copilot"
)
