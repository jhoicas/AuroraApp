package models

import (
	"time"

	"github.com/google/uuid"
)

// Product pertenece a un Program (maestro global DNP, sin tenant_id).
type Product struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	ProgramID uuid.UUID `gorm:"type:uuid;not null;index" json:"program_id"`
	Code      string    `gorm:"type:varchar(50);not null;index;uniqueIndex:idx_products_program_code" json:"code"`
	CodeBPIN  *string   `gorm:"column:code_bpin;type:varchar(50);index" json:"code_bpin,omitempty"`
	Name      string    `gorm:"type:text;not null;index" json:"name"`
	CreatedAt time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null" json:"updated_at"`

	Program Program `gorm:"foreignKey:ProgramID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"program,omitempty"`
}

func (Product) TableName() string {
	return "products"
}
