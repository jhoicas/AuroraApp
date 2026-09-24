package models

import "time"

// MgaCatalogActor representa un tipo de actor en la formulación MGA (DNP).
// Los IDs coinciden con los asignados por el DNP en su sistema.
type MgaCatalogActor struct {
	ID        int       `gorm:"column:id;primaryKey" json:"id"`
	Name      string    `gorm:"column:name;type:varchar(200);not null;uniqueIndex" json:"name"`
	CreatedAt time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null" json:"updated_at"`
}

func (MgaCatalogActor) TableName() string {
	return "mga_catalog_actors"
}
