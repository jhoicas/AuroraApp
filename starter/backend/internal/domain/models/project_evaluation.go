package models

import (
	"time"

	"github.com/google/uuid"
)

// ProjectEvaluation resultado financiero MGA (VPN/TIR) por alternativa.
type ProjectEvaluation struct {
	ID              uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProjectID       uuid.UUID `gorm:"column:project_id;type:uuid;not null;index" json:"project_id"`
	TenantID        uuid.UUID `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	AlternativeName string    `gorm:"column:alternative_name;type:varchar(255);not null" json:"alternative_name"`
	DiscountRate    float64   `gorm:"column:discount_rate;not null" json:"discount_rate"`
	CashFlows       string    `gorm:"column:cash_flows;type:jsonb;not null" json:"cash_flows"`
	VPN             float64   `gorm:"column:vpn;not null" json:"vpn"`
	TIR             *float64  `gorm:"column:tir" json:"tir,omitempty"`
	CreatedAt       time.Time `gorm:"column:created_at;not null" json:"created_at"`
}

func (ProjectEvaluation) TableName() string {
	return "project_evaluations"
}
