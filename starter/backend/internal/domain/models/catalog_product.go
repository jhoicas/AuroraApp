package models

import (
	"time"

	"github.com/google/uuid"
)

// CatalogProduct fila del catálogo DNP catalogo_productos (maestro plano).
// Un producto pertenece a un Programa (codigo_programa) y este a un Sector.
// Solo los códigos identificadores usan varchar corto; el resto es TEXT sin límite.
type CatalogProduct struct {
	ID                      uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID                *uuid.UUID `gorm:"column:tenant_id;type:uuid;index" json:"tenant_id,omitempty"`
	Sector                  string     `gorm:"column:sector;type:varchar(50)" json:"sector"`
	NombreSector            string     `gorm:"column:nombre_sector;type:text" json:"nombre_sector"`
	CodigoPrograma          string     `gorm:"column:codigo_programa;type:varchar(50);not null;index" json:"codigo_programa"`
	NombrePrograma          string     `gorm:"column:nombre_programa;type:text" json:"nombre_programa"`
	CodigoProducto          string     `gorm:"column:codigo_producto;type:varchar(50);not null;uniqueIndex:idx_catalogo_productos_codigo" json:"codigo_producto"`
	Producto                string     `gorm:"column:producto;type:text;not null" json:"producto"`
	Descripcion             string     `gorm:"column:descripcion;type:text" json:"descripcion"`
	MedidoATravesDe         string     `gorm:"column:medido_a_traves_de;type:text" json:"medido_a_traves_de"`
	CodigoIndicadorProducto string     `gorm:"column:codigo_indicador_producto;type:text" json:"codigo_indicador_producto"`
	IndicadorProducto       string     `gorm:"column:indicador_producto;type:text" json:"indicador_producto"`
	UnidadDeMedida          string     `gorm:"column:unidad_de_medida;type:text" json:"unidad_de_medida"`
	IndicadorPrincipal      bool       `gorm:"column:indicador_principal;default:false" json:"indicador_principal"`
	EsNacional              bool       `gorm:"column:es_nacional;default:false" json:"es_nacional"`
	EsTerritorial           bool       `gorm:"column:es_territorial;default:false" json:"es_territorial"`
	ODS                     string     `gorm:"column:ods;type:text" json:"ods"`
	MetaODS                 string     `gorm:"column:meta_ods;type:text" json:"meta_ods"`
	TipologiaGeneralSUIFP   string     `gorm:"column:tipologia_general_suifp;type:text" json:"tipologia_general_suifp"`
	TipologiaD              bool       `gorm:"column:tipologia_d;default:false" json:"tipologia_d"`
	TipologiaE              bool       `gorm:"column:tipologia_e;default:false" json:"tipologia_e"`
	TipologiaAPIIP          bool       `gorm:"column:tipologia_a_piip;default:false" json:"tipologia_a_piip"`
	TipologiaBPIIP          bool       `gorm:"column:tipologia_b_piip;default:false" json:"tipologia_b_piip"`
	TipologiaCPIIP          bool       `gorm:"column:tipologia_c_piip;default:false" json:"tipologia_c_piip"`
	TieneEDT                bool       `gorm:"column:tiene_edt;default:false" json:"tiene_edt"`
	EDT                     string     `gorm:"column:edt;type:text" json:"edt"`
	CreatedAt               time.Time  `gorm:"column:created_at;not null" json:"created_at"`
}

func (CatalogProduct) TableName() string {
	return "catalogo_productos"
}
