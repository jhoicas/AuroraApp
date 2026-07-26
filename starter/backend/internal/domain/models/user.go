package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User representa un usuario del sistema.
// TenantID es NULL solo para SUPER_ADMIN (usuario global).
type User struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID     *uuid.UUID     `gorm:"column:tenant_id;type:uuid;index" json:"tenant_id,omitempty"`
	RoleID       uuid.UUID      `gorm:"column:role_id;type:uuid;not null;index" json:"role_id"`
	Email        string         `gorm:"column:email;type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash string         `gorm:"column:password_hash;type:varchar(255);not null" json:"-"`
	FullName     string         `gorm:"column:full_name;type:varchar(255);not null" json:"full_name"`
	IsActive     bool           `gorm:"column:is_active;not null;default:true" json:"is_active"`
	CreatedAt    time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Role   Role    `gorm:"foreignKey:RoleID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"role,omitempty"`
	Tenant *Tenant `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"tenant,omitempty"`
}

func (User) TableName() string {
	return "users"
}
