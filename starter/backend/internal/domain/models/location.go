package models

import "time"

// Region agrupación geográfica de departamentos (codificación DANE).
// ID es el código numérico oficial DANE, no un UUID auto-generado.
type Region struct {
	ID            int            `gorm:"column:id;primaryKey;autoIncrement:false" json:"id"`
	Name          string         `gorm:"column:name;type:varchar(255);not null" json:"name"`
	IsActive      bool           `gorm:"column:is_active;not null;default:true" json:"is_active"`
	CreatedAt     time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt     time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	Departamentos []Departamento `gorm:"foreignKey:RegionID" json:"departamentos,omitempty"`
}

func (Region) TableName() string { return "regiones" }

// Departamento división administrativa de segundo nivel (codificación DANE).
type Departamento struct {
	ID         int         `gorm:"column:id;primaryKey;autoIncrement:false" json:"id"`
	Name       string      `gorm:"column:name;type:varchar(255);not null" json:"name"`
	RegionID   int         `gorm:"column:region_id;not null;index" json:"region_id"`
	IsActive   bool        `gorm:"column:is_active;not null;default:true" json:"is_active"`
	CreatedAt  time.Time   `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt  time.Time   `gorm:"column:updated_at;not null" json:"updated_at"`
	Region     Region      `gorm:"foreignKey:RegionID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Municipios []Municipio `gorm:"foreignKey:DepartamentoID" json:"municipios,omitempty"`
}

func (Departamento) TableName() string { return "departamentos" }

// Municipio división administrativa de tercer nivel (codificación DANE).
type Municipio struct {
	ID              int          `gorm:"column:id;primaryKey;autoIncrement:false" json:"id"`
	Name            string       `gorm:"column:name;type:varchar(255);not null" json:"name"`
	DepartamentoID  int          `gorm:"column:departamento_id;not null;index" json:"departamento_id"`
	IsActive        bool         `gorm:"column:is_active;not null;default:true" json:"is_active"`
	CreatedAt       time.Time    `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt       time.Time    `gorm:"column:updated_at;not null" json:"updated_at"`
	Departamento    Departamento `gorm:"foreignKey:DepartamentoID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (Municipio) TableName() string { return "municipios" }
