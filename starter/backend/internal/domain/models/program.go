package models

import (
	"time"

	"github.com/google/uuid"
)

// Program vista ligera sobre programas_subprogramas (explorador DNP por sector).
// Campos Go en inglés; columnas PostgreSQL en español.
type Program struct {
	ID       uuid.UUID `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	SectorID uuid.UUID `gorm:"column:sector_id;type:uuid;not null;index" json:"sector_id"`
	// Sin uniqueIndex: la llave única real es (codigo_programa, codigo_subprograma)
	// y la declara ProgramSubprogram. Declararla aquí crearía idx_prog_subprog_codes
	// sobre una sola columna y rechazaría subprogramas legítimos del maestro DNP.
	Code      string    `gorm:"column:codigo_programa;type:varchar(50);not null;index" json:"code"`
	Name      string    `gorm:"column:nombre_programa;type:text;not null;index" json:"name"`
	CreatedAt time.Time `gorm:"column:created_at;not null" json:"created_at"`
	// UpdatedAt no existe en programas_subprogramas; se ignora en persistencia.
	UpdatedAt time.Time `gorm:"-" json:"updated_at"`

	Sector Sector `gorm:"foreignKey:SectorID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"sector,omitempty"`
	// catalogo_productos no tiene columna program_id (Product.ProgramID es gorm:"-"),
	// así que la relación se resuelve por código en los repositorios, no por FK.
	Products []Product `gorm:"-" json:"products,omitempty"`
}

func (Program) TableName() string {
	return "programas_subprogramas"
}
