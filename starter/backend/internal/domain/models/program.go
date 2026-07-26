package models

import (
	"time"

	"github.com/google/uuid"
)

// Program pertenece a un Sector (maestro global DNP, sin tenant_id).
type Program struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SectorID  uuid.UUID `gorm:"type:uuid;not null;index" json:"sector_id"`
	Code      string    `gorm:"type:varchar(50);not null;uniqueIndex:idx_programs_sector_code" json:"code"`
	Name      string    `gorm:"type:text;not null;index" json:"name"`
	CreatedAt time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null" json:"updated_at"`

	Sector   Sector    `gorm:"foreignKey:SectorID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"sector,omitempty"`
	Products []Product `gorm:"foreignKey:ProgramID" json:"products,omitempty"`
}

func (Program) TableName() string {
	return "programs"
}
