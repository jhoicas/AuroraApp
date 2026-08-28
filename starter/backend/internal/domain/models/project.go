package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Project representa un proyecto de inversión pública (formulación MGA).
// TenantID es obligatorio: aislamiento estricto multi-tenant.
type Project struct {
	ID                 uuid.UUID      `gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TenantID           uuid.UUID      `gorm:"column:tenant_id;type:uuid;not null;index;uniqueIndex:idx_projects_tenant_code_bpin" json:"tenant_id"`
	CreatorID          uuid.UUID      `gorm:"column:creator_id;type:uuid;not null;index" json:"creator_id"`
	CodeBPIN           *string        `gorm:"column:code_bpin;type:varchar(50);uniqueIndex:idx_projects_tenant_code_bpin" json:"code_bpin,omitempty"`
	Name               string         `gorm:"column:name;type:text;not null" json:"name"`
	Description        string         `gorm:"column:description;type:text" json:"description,omitempty"`
	Sector             string         `gorm:"column:sector;type:varchar(255);index" json:"sector,omitempty"`
	SectorID           *uuid.UUID     `gorm:"column:sector_id;type:uuid;index" json:"sector_id,omitempty"`
	ProgramCode        *string        `gorm:"column:program_code;type:varchar(50);index" json:"program_code,omitempty"`
	ProductCode        *string        `gorm:"column:product_code;type:varchar(50);index" json:"product_code,omitempty"`
	ProblemDescription string         `gorm:"column:problem_description;type:text" json:"problem_description,omitempty"`
	GeneralObjective   string         `gorm:"column:general_objective;type:text" json:"general_objective,omitempty"`
	Status             string         `gorm:"column:status;type:varchar(50);not null;default:'DRAFT';index" json:"status"`
	CreatedAt          time.Time      `gorm:"column:created_at;not null" json:"created_at"`
	UpdatedAt          time.Time      `gorm:"column:updated_at;not null" json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"column:deleted_at;index" json:"-"`

	Tenant      Tenant       `gorm:"foreignKey:TenantID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"tenant,omitempty"`
	Creator     User         `gorm:"foreignKey:CreatorID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"creator,omitempty"`
	AILogs      []AILog      `gorm:"foreignKey:ProjectID" json:"ai_logs,omitempty"`
	BudgetItems []BudgetItem `gorm:"foreignKey:ProjectID" json:"budget_items,omitempty"`
}

func (Project) TableName() string {
	return "projects"
}
