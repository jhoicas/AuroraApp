package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// NeedAnnualValue fila de la serie anual de oferta/demanda de una necesidad.
// Deficit = Demanda - Oferta y siempre lo calcula el backend.
type NeedAnnualValue struct {
	Anio    int     `json:"anio"`
	Oferta  float64 `json:"oferta"`
	Demanda float64 `json:"demanda"`
	Deficit float64 `json:"deficit"`
}

// MgaNeed bien o servicio del estudio de necesidades (MGA Preparación) de una alternativa.
// AlternativeID es el id de la alternativa de Identificación (viene del JSON de formulación,
// no de mga_alternatives), por eso no tiene FK.
// ValoresAnuales almacena []NeedAnnualValue en JSONB: una fila por año entre
// AnioInicial y UltimoAnioProyectado.
type MgaNeed struct {
	ID                   uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID             uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index" json:"tenant_id"`
	ProjectID            uuid.UUID      `gorm:"column:project_id;type:uuid;not null;index" json:"project_id"`
	AlternativeID        string         `gorm:"column:alternative_id;type:varchar(64);not null;index" json:"alternative_id"`
	BienServicio         string         `gorm:"column:bien_servicio;type:varchar(200);not null" json:"bien_servicio"`
	Descripcion          string         `gorm:"column:descripcion;type:text;not null;default:''" json:"descripcion"`
	DescripcionOferta    string         `gorm:"column:descripcion_oferta;type:text;not null;default:''" json:"descripcion_oferta"`
	DescripcionDemanda   string         `gorm:"column:descripcion_demanda;type:text;not null;default:''" json:"descripcion_demanda"`
	UnidadMedidaID       int            `gorm:"column:unidad_medida_id;not null" json:"unidad_medida_id"`
	AnioInicial          int            `gorm:"column:anio_inicial;not null" json:"anio_inicial"`
	AnioFinal            int            `gorm:"column:anio_final;not null" json:"anio_final"`
	UltimoAnioProyectado int            `gorm:"column:ultimo_anio_proyectado;not null" json:"ultimo_anio_proyectado"`
	ValoresAnuales       string         `gorm:"column:valores_anuales;type:jsonb;not null;default:'[]'" json:"valores_anuales"`
	CreatedAt            time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt            time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant  Tenant  `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (MgaNeed) TableName() string {
	return "mga_needs"
}
