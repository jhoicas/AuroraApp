package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Sector catálogo DNP (maestro global, sin tenant_id).
// Campos Go en inglés; columnas PostgreSQL en español (tabla sectores).
type Sector struct {
	ID           uuid.UUID `gorm:"column:id;type:uuid;primaryKey" json:"id"`
	Code         string    `gorm:"column:codigo;type:varchar(50);uniqueIndex;not null" json:"code"`
	Name         string    `gorm:"column:nombre;type:varchar(255);not null;index" json:"name"`
	Application  string    `gorm:"column:aplicacion;type:text" json:"application"`
	Observations string    `gorm:"column:observaciones;type:text" json:"observations"`
	CreatedAt    time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at;not null" json:"updated_at"`

	Programs []Program `gorm:"foreignKey:SectorID" json:"programs,omitempty"`
}

func (s *Sector) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

func (Sector) TableName() string {
	return "sectores"
}
