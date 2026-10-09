package models

import "time"

// ProducedGood es un bien producido del catálogo RPC (Razón Precio Cuenta) usado en
// el módulo Ingresos y Beneficios de la preparación MGA. Administrable por SUPER_ADMIN.
type ProducedGood struct {
	ID          uint      `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Description string    `gorm:"column:description;type:text;not null;index:idx_catalogo_bienes_producidos_description" json:"description"`
	Rpc         float64   `gorm:"column:rpc;type:numeric(8,4);not null;default:0" json:"rpc"`
	CreatedAt   time.Time `gorm:"column:created_at;not null;default:now()" json:"created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at;not null;default:now()" json:"updated_at"`
}

func (ProducedGood) TableName() string {
	return "catalogo_bienes_producidos"
}
