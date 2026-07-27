package models

import (
	"time"

	"github.com/google/uuid"
)

// Product vista ligera sobre catalogo_productos (explorador / presupuesto DNP).
// Campos Go en inglés; columnas PostgreSQL en español.
type Product struct {
	ID uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	// ProgramID no existe en catalogo_productos; se ignora en persistencia.
	ProgramID uuid.UUID `gorm:"-" json:"program_id"`
	Code      string    `gorm:"column:codigo_producto;type:varchar(50);not null;uniqueIndex:idx_catalogo_productos_codigo" json:"code"`
	CodeBPIN  *string   `gorm:"-" json:"code_bpin,omitempty"`
	Name      string    `gorm:"column:producto;type:text;not null;index" json:"name"`
	CreatedAt time.Time `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"-" json:"updated_at"`

	Program Program `gorm:"-" json:"program,omitempty"`
}

func (Product) TableName() string {
	return "catalogo_productos"
}
