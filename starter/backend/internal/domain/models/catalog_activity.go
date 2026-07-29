package models

import (
	"time"

	"github.com/google/uuid"
)

// CatalogActivity fila del catálogo DNP catalogo_actividades (lista de actividades).
// Llave de negocio: codigo_actividad (string, preserva ceros a la izquierda).
// El ID UUID es la PK interna.
type CatalogActivity struct {
	ID                   uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID             *uuid.UUID `gorm:"column:tenant_id;type:uuid;index" json:"tenant_id,omitempty"`
	CodigoActividad      string     `gorm:"column:codigo_actividad;type:varchar(50);not null;uniqueIndex:idx_actividad_codigo" json:"codigo_actividad"`
	ListadoDeActividades string     `gorm:"column:listado_de_actividades;type:text" json:"listado_de_actividades"`
	UnidadDeMedida       string     `gorm:"column:unidad_de_medida;type:text" json:"unidad_de_medida"`
	CreatedAt            time.Time  `gorm:"column:created_at;not null" json:"created_at"`
}

func (CatalogActivity) TableName() string {
	return "catalogo_actividades"
}
