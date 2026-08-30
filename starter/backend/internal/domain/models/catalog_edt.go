package models

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// CatalogEdt fila del catálogo DNP catalogo_edt (matriz EDT / actividades).
//
// Llave de negocio (única): (codigo_producto_estandarizado, codigo_entregable_l1,
// codigo_entregable_l2, codigo_entregable_l3, codigo_actividad).
// El ID UUID es la PK interna; la unicidad de negocio NO reemplaza al ID.
// Todos los códigos se almacenan como string para preservar ceros a la izquierda.
type CatalogEdt struct {
	ID                          uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID                    *uuid.UUID `gorm:"column:tenant_id;type:uuid;index" json:"tenant_id,omitempty"`
	CodigoProductoEstandarizado string     `gorm:"column:codigo_producto_estandarizado;type:varchar(50);not null;uniqueIndex:idx_edt_composite" json:"codigo_producto_estandarizado"`
	NombreProducto              string     `gorm:"column:nombre_producto;type:text" json:"nombre_producto"`
	CodigoEntregableL1          string     `gorm:"column:codigo_entregable_l1;type:varchar(100);not null;default:'';uniqueIndex:idx_edt_composite" json:"codigo_entregable_l1"`
	NombreEntregableL1          string     `gorm:"column:nombre_entregable_l1;type:text" json:"nombre_entregable_l1"`
	CodigoEntregableL2          string     `gorm:"column:codigo_entregable_l2;type:varchar(100);not null;default:'';uniqueIndex:idx_edt_composite" json:"codigo_entregable_l2"`
	NombreEntregableL2          string     `gorm:"column:nombre_entregable_l2;type:text" json:"nombre_entregable_l2"`
	CodigoEntregableL3          string     `gorm:"column:codigo_entregable_l3;type:varchar(100);not null;default:'';uniqueIndex:idx_edt_composite" json:"codigo_entregable_l3"`
	NombreEntregableL3          string     `gorm:"column:nombre_entregable_l3;type:text" json:"nombre_entregable_l3"`
	CodigoActividad             string     `gorm:"column:codigo_actividad;type:varchar(100);not null;default:'';uniqueIndex:idx_edt_composite" json:"codigo_actividad"`
	Actividad                   string     `gorm:"column:actividad;type:text" json:"actividad"`
	UnidadDeMedida              string     `gorm:"column:unidad_de_medida;type:text" json:"unidad_de_medida"`
	CreatedAt                   time.Time  `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt                   time.Time  `gorm:"column:updated_at" json:"updated_at,omitempty"`
}

func (CatalogEdt) TableName() string {
	return "catalogo_edt"
}

// EdtCompositeKey construye la llave lógica de negocio EDT (5 códigos, solo strings).
func EdtCompositeKey(
	codigoProducto, codigoEntL1, codigoEntL2, codigoEntL3, codigoActividad string,
) string {
	parts := []string{
		strings.TrimSpace(codigoProducto),
		strings.TrimSpace(codigoEntL1),
		strings.TrimSpace(codigoEntL2),
		strings.TrimSpace(codigoEntL3),
		strings.TrimSpace(codigoActividad),
	}
	return strings.Join(parts, "\x1f")
}
