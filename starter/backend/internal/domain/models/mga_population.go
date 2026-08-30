package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MgaPopulation segmento de población afectada u objetivo del proyecto MGA.
// PopulationType: "afectada" | "objetivo".
// Locations almacena arreglos demográficos/geográficos en JSONB.
type MgaPopulation struct {
	ID             uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID       uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ProjectID      uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index" json:"project_id"`
	PopulationType string         `gorm:"column:population_type;type:varchar(50);not null" json:"population_type"`
	TotalNumber    int            `gorm:"column:total_number;not null;default:0" json:"total_number"`
	Source         string         `gorm:"column:source;type:text;not null" json:"source"`
	Locations      string         `gorm:"column:locations;type:jsonb;not null;default:'[]'" json:"locations"`
	CreatedAt      time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt      time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant  Tenant  `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (MgaPopulation) TableName() string {
	return "mga_populations"
}
