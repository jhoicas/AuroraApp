package models

import (
	"time"
)

type Municipality struct {
	ID           uint       `json:"id" gorm:"primaryKey"`
	Code         string     `json:"code" gorm:"uniqueIndex;not null;size:10"`
	Name         string     `json:"name" gorm:"not null"`
	DepartmentID uint       `json:"department_id" gorm:"not null"`
	Department   Department `json:"department" gorm:"foreignKey:DepartmentID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
