package models

import (
	"time"

	"github.com/google/uuid"
)

// Role representa un rol del sistema (RBAC).
// SUPER_ADMIN es global; el resto opera dentro de un tenant.
type Role struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Code        string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	CreatedAt   time.Time `gorm:"not null" json:"created_at"`
	UpdatedAt   time.Time `gorm:"not null" json:"updated_at"`
}

func (Role) TableName() string {
	return "roles"
}
