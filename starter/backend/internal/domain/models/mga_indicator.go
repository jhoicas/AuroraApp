package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MgaIndicator indicador de seguimiento del objetivo general o específico.
type MgaIndicator struct {
	ID                  uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID            uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ProjectID           uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index" json:"project_id"`
	SpecificObjectiveID *uuid.UUID     `gorm:"column:specific_objective_id;type:uuid;index" json:"specific_objective_id,omitempty"`
	Name                string         `gorm:"column:name;type:text;not null" json:"name"`
	Unit                string         `gorm:"column:unit;type:varchar(255);not null" json:"unit"`
	Target              float64        `gorm:"column:target;type:numeric(18,2);not null" json:"target"`
	SourceType          string         `gorm:"column:source_type;type:varchar(100);not null" json:"source_type"`
	VerificationSource  string         `gorm:"column:verification_source;type:text;not null" json:"verification_source"`
	SortOrder           int            `gorm:"column:sort_order;not null;default:0" json:"sort_order"`
	CreatedAt           time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt           time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant            Tenant                `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project           Project               `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	SpecificObjective *MgaSpecificObjective `gorm:"foreignKey:SpecificObjectiveID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"-"`
}

func (MgaIndicator) TableName() string {
	return "mga_indicators"
}
