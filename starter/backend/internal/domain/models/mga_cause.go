package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MgaCause representa una causa del árbol de problemas MGA.
type MgaCause struct {
	ID          uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID    uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ProjectID   uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index" json:"project_id"`
	ParentID    *uuid.UUID     `gorm:"column:parent_id;type:uuid;index" json:"parent_id,omitempty"`
	CauseType   string         `gorm:"column:cause_type;type:varchar(50);not null" json:"cause_type"`
	Description string         `gorm:"column:description;type:text;not null" json:"description"`
	SortOrder   int            `gorm:"column:sort_order;not null;default:0" json:"sort_order"`
	CreatedAt   time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant            Tenant                `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project           Project               `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Parent            *MgaCause             `gorm:"foreignKey:ParentID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"-"`
	SpecificObjective *MgaSpecificObjective `gorm:"foreignKey:CauseID;references:ID" json:"specific_objective,omitempty"`
}

func (MgaCause) TableName() string {
	return "mga_causes"
}
