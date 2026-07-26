package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BudgetItem ítem de presupuesto de un proyecto MGA.
// TenantID es obligatorio para aislamiento multi-tenant.
type BudgetItem struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"tenant_id"`
	ProjectID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"project_id"`
	ProductID   *uuid.UUID     `gorm:"type:uuid;index" json:"product_id,omitempty"`
	Description string         `gorm:"type:text;not null" json:"description"`
	Amount      float64        `gorm:"type:numeric(18,2);not null" json:"amount"`
	CreatedAt   time.Time      `gorm:"not null" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"not null" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Tenant  Tenant   `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Project Project  `gorm:"foreignKey:ProjectID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
	Product *Product `gorm:"foreignKey:ProductID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"product,omitempty"`
}

func (BudgetItem) TableName() string {
	return "budget_items"
}
