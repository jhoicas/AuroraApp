package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MgaParticipant actor o entidad involucrada en la formulación MGA.
type MgaParticipant struct {
	ID           uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID     uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ProjectID    uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index" json:"project_id"`
	Actor        string         `gorm:"column:actor;type:text;not null" json:"actor"`
	Entity       string         `gorm:"column:entity;type:text;not null" json:"entity"`
	Position     string         `gorm:"column:position;type:varchar(100);not null" json:"position"`
	Interests    string         `gorm:"column:interests;type:text;not null" json:"interests"`
	Contribution string         `gorm:"column:contribution;type:text;not null" json:"contribution"`
	CreatedAt    time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant  Tenant  `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (MgaParticipant) TableName() string {
	return "mga_participants"
}
