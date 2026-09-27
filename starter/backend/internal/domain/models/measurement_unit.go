package models

import "time"

// MeasurementUnit representa una unidad de medida para el catálogo MGA y estudio de necesidades.
type MeasurementUnit struct {
	ID        int       `gorm:"column:id;primaryKey;autoIncrement:false" json:"id"`
	Name      string    `gorm:"column:name;type:varchar(255);not null" json:"name"`
	CreatedAt time.Time `gorm:"column:created_at;not null;default:now()" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null;default:now()" json:"updated_at"`
}

func (MeasurementUnit) TableName() string {
	return "catalogo_unidades_medida"
}
