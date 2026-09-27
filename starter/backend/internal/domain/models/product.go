package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Product vista ligera sobre catalogo_productos (explorador / presupuesto DNP).
// Campos Go en inglés; columnas PostgreSQL en español.
type Product struct {
	ID        uuid.UUID  `gorm:"column:id;type:uuid;primaryKey" json:"id"`
	ProgramID *uuid.UUID `gorm:"column:program_id;type:uuid;index" json:"program_id,omitempty"`
	Code      string     `gorm:"column:codigo_producto;type:varchar(50);not null;index" json:"code"`
	CodeBPIN  *string    `gorm:"-" json:"code_bpin,omitempty"`
	Name      string     `gorm:"column:producto;type:text;not null;index" json:"name"`
	CreatedAt time.Time  `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt time.Time  `gorm:"column:updated_at" json:"updated_at,omitempty"`

	Program Program `gorm:"-" json:"program,omitempty"`
}

func (p *Product) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

func (Product) TableName() string {
	return "catalogo_productos"
}

