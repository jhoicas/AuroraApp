package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MgaSpecificObjective objetivo específico vinculado a una causa MGA.
type MgaSpecificObjective struct {
	ID          uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID    uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ProjectID   uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index" json:"project_id"`
	CauseID     uuid.UUID      `gorm:"column:cause_id;type:uuid;not null;uniqueIndex" json:"cause_id"`
	Description string         `gorm:"column:description;type:text;not null" json:"description"`
	CreatedAt   time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant  Tenant   `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project Project  `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Cause   MgaCause `gorm:"foreignKey:CauseID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (MgaSpecificObjective) TableName() string {
	return "mga_specific_objectives"
}
