package models

import "time"

// MgaCatalogEntity representa una entidad vinculada a un actor MGA.
// La relación actor_id → mga_catalog_actors.id define las listas dependientes.
type MgaCatalogEntity struct {
	ID        int       `gorm:"column:id;primaryKey" json:"id"`
	ActorID   int       `gorm:"column:actor_id;not null;index" json:"actor_id"`
	Name      string    `gorm:"column:name;type:varchar(500);not null" json:"name"`
	CreatedAt time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null" json:"updated_at"`

	Actor MgaCatalogActor `gorm:"foreignKey:ActorID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (MgaCatalogEntity) TableName() string {
	return "mga_catalog_entities"
}
