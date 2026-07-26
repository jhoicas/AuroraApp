package models

import (
	"time"

	"github.com/google/uuid"
)

// ProgramSubprogram fila del catálogo DNP programas_subprogramas (maestro plano).
type ProgramSubprogram struct {
	ID                uuid.UUID  `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID          *uuid.UUID `gorm:"column:tenant_id;type:uuid;index" json:"tenant_id,omitempty"`
	SectorID          uuid.UUID  `gorm:"column:sector_id;type:uuid;not null;index" json:"sector_id"`
	CodigoSector      string     `gorm:"column:codigo_sector;type:varchar(50);not null;index" json:"codigo_sector"`
	NombreSector      string     `gorm:"column:nombre_sector;type:varchar(255);not null" json:"nombre_sector"`
	CodigoPrograma    string     `gorm:"column:codigo_programa;type:varchar(50);not null;uniqueIndex:idx_prog_subprog_codes" json:"codigo_programa"`
	NombrePrograma    string     `gorm:"column:nombre_programa;type:text;not null" json:"nombre_programa"`
	AmbitoAplicacion  string     `gorm:"column:ambito_aplicacion;type:text" json:"ambito_aplicacion"`
	CodigoSubprograma string     `gorm:"column:codigo_subprograma;type:varchar(50);not null;uniqueIndex:idx_prog_subprog_codes" json:"codigo_subprograma"`
	NombreSubprograma string     `gorm:"column:nombre_subprograma;type:text;not null" json:"nombre_subprograma"`
	Observaciones     string     `gorm:"column:observaciones;type:text" json:"observaciones"`
	CreatedAt         time.Time  `gorm:"column:created_at;not null" json:"created_at"`
}

func (ProgramSubprogram) TableName() string {
	return "programas_subprogramas"
}
