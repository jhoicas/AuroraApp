package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MgaEffect representa un efecto del árbol de problemas MGA.
// EffectType: "directo" | "indirecto".
type MgaEffect struct {
	ID          uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID    uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ProjectID   uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index" json:"project_id"`
	ParentID    *uuid.UUID     `gorm:"column:parent_id;type:uuid;index" json:"parent_id,omitempty"`
	EffectType  string         `gorm:"column:effect_type;type:varchar(50);not null" json:"effect_type"`
	Description string         `gorm:"column:description;type:text;not null" json:"description"`
	SortOrder   int            `gorm:"column:sort_order;not null;default:0" json:"sort_order"`
	CreatedAt   time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant  Tenant     `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project Project    `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Parent  *MgaEffect `gorm:"foreignKey:ParentID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"-"`
}

func (MgaEffect) TableName() string {
	return "mga_effects"
}
