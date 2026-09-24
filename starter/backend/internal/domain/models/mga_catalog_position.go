package models

import "time"

// MgaCatalogPosition representa una posición del participante en la formulación MGA.
// Los IDs coinciden con los asignados por el DNP.
type MgaCatalogPosition struct {
	ID        int       `gorm:"column:id;primaryKey" json:"id"`
	Name      string    `gorm:"column:name;type:varchar(200);not null;uniqueIndex" json:"name"`
	CreatedAt time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null" json:"updated_at"`
}

func (MgaCatalogPosition) TableName() string {
	return "mga_catalog_positions"
}
