package models

import (
	"time"

	"github.com/google/uuid"
)

// Sector catálogo DNP (maestro global, sin tenant_id).
// Campos alineados con el archivo oficial DNP: Código, Nombre, Aplicación, Observaciones.
type Sector struct {
	ID           uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Code         string    `gorm:"column:code;type:varchar(50);uniqueIndex;not null" json:"code"`
	Name         string    `gorm:"column:name;type:varchar(255);not null;index" json:"name"`
	Application  string    `gorm:"column:application;type:text" json:"application"`
	Observations string    `gorm:"column:observations;type:text" json:"observations"`
	CreatedAt    time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at;not null" json:"updated_at"`

	Programs []Program `gorm:"foreignKey:SectorID" json:"programs,omitempty"`
}

func (Sector) TableName() string {
	return "sectores"
}
