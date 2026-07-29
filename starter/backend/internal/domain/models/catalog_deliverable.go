package models

import (
	"time"

	"github.com/google/uuid"
)

// CatalogDeliverable fila del catálogo DNP catalogo_entregables (lista de entregables).
// Llave de negocio: codigo_entregable (string, preserva ceros a la izquierda).
// El ID UUID es la PK interna.
type CatalogDeliverable struct {
	ID                   uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID             *uuid.UUID `gorm:"column:tenant_id;type:uuid;index" json:"tenant_id,omitempty"`
	CodigoEntregable     string     `gorm:"column:codigo_entregable;type:varchar(50);not null;uniqueIndex:idx_entregable_codigo" json:"codigo_entregable"`
	ListadoDeEntregables string     `gorm:"column:listado_de_entregables;type:text" json:"listado_de_entregables"`
	CreatedAt            time.Time  `gorm:"column:created_at;not null" json:"created_at"`
}

func (CatalogDeliverable) TableName() string {
	return "catalogo_entregables"
}
