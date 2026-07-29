package models

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// CatalogOds fila del catálogo DNP catalogo_ods (objetivos y metas ODS).
// Llave de negocio: (cod_objetivo_ods, codigo_meta_ods) — strings para preservar "1.10" ≠ "1.1".
// El ID UUID es la PK interna.
type CatalogOds struct {
	ID                     uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID               *uuid.UUID `gorm:"column:tenant_id;type:uuid;index" json:"tenant_id,omitempty"`
	CodObjetivoOds         string     `gorm:"column:cod_objetivo_ods;type:varchar(50);not null;uniqueIndex:idx_ods_obj_meta" json:"cod_objetivo_ods"`
	DescripcionObjetivoOds string     `gorm:"column:descripcion_objetivo_ods;type:text" json:"descripcion_objetivo_ods"`
	CodigoMetaOds          string     `gorm:"column:codigo_meta_ods;type:varchar(50);not null;default:'';uniqueIndex:idx_ods_obj_meta" json:"codigo_meta_ods"`
	DescripcionMetaOds     string     `gorm:"column:descripcion_meta_ods;type:text" json:"descripcion_meta_ods"`
	CreatedAt              time.Time  `gorm:"column:created_at;not null" json:"created_at"`
}

func (CatalogOds) TableName() string {
	return "catalogo_ods"
}

// OdsCompositeKey construye la llave lógica objetivo + meta.
func OdsCompositeKey(codObjetivo, codigoMeta string) string {
	return strings.TrimSpace(codObjetivo) + "_" + strings.TrimSpace(codigoMeta)
}
