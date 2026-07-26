package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Tenant representa una entidad territorial (alcaldía, gobernación, etc.).
type Tenant struct {
	ID   uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name string    `gorm:"type:varchar(255);not null" json:"name"`
	// Nombres explícitos: evita que GORM gestione "uni_tenants_*" (DROP sin IF EXISTS en Supabase).
	Domain       *string        `gorm:"type:varchar(255);uniqueIndex:idx_tenants_domain" json:"domain,omitempty"`
	NIT          *string        `gorm:"type:varchar(50);uniqueIndex:idx_tenants_nit" json:"nit,omitempty"`
	ContactEmail string         `gorm:"type:varchar(255);not null" json:"contact_email"`
	Status       string         `gorm:"type:varchar(20);not null;default:'ACTIVE';index" json:"status"`
	IsActive     bool           `gorm:"not null;default:true" json:"is_active"`
	CreatedAt    time.Time      `gorm:"not null" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"not null" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	Users    []User    `gorm:"foreignKey:TenantID" json:"users,omitempty"`
	Projects []Project `gorm:"foreignKey:TenantID" json:"projects,omitempty"`
}

func (Tenant) TableName() string {
	return "tenants"
}
