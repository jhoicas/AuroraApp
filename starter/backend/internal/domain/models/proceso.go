package models

import "time"

// Proceso verbo rector del proyecto de inversión MGA (catálogo DNP, 75 ítems).
// El ID es el código secuencial oficial DNP (1-75).
type Proceso struct {
	ID        int       `gorm:"column:id;primaryKey;autoIncrement:false" json:"id"`
	Name      string    `gorm:"column:name;type:varchar(255);not null;uniqueIndex" json:"name"`
	CreatedAt time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null" json:"updated_at"`
}

func (Proceso) TableName() string { return "procesos" }
