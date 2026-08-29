package dto

// CreateMgaCauseRequest crea una causa MGA (y opcionalmente su objetivo específico).
type CreateMgaCauseRequest struct {
	CauseType         string  `json:"cause_type" validate:"required,oneof=directa indirecta"`
	Description       string  `json:"description" validate:"required,min=2,max=5000"`
	ParentID          *string `json:"parent_id" validate:"omitempty,uuid"`
	SortOrder         *int    `json:"sort_order" validate:"omitempty,gte=0"`
	SpecificObjective *string `json:"specific_objective" validate:"omitempty,max=5000"`
}

// UpdateMgaCauseRequest actualiza una causa existente.
type UpdateMgaCauseRequest struct {
	CauseType   *string `json:"cause_type" validate:"omitempty,oneof=directa indirecta"`
	Description *string `json:"description" validate:"omitempty,min=2,max=5000"`
	ParentID    *string `json:"parent_id" validate:"omitempty,uuid"`
	SortOrder   *int    `json:"sort_order" validate:"omitempty,gte=0"`
}

// UpdateMgaObjectiveRequest actualiza el objetivo específico.
type UpdateMgaObjectiveRequest struct {
	Description string `json:"description" validate:"required,min=2,max=5000"`
}

// CreateMgaIndicatorRequest crea un indicador de seguimiento.
type CreateMgaIndicatorRequest struct {
	Name                string  `json:"name" validate:"required,min=2,max=500"`
	Unit                string  `json:"unit" validate:"required,min=1,max=255"`
	Target              float64 `json:"target" validate:"required,gte=0"`
	SourceType          string  `json:"source_type" validate:"required,min=1,max=100"`
	VerificationSource  string  `json:"verification_source" validate:"required,min=2,max=2000"`
	SpecificObjectiveID *string `json:"specific_objective_id" validate:"omitempty,uuid"`
	SortOrder           *int    `json:"sort_order" validate:"omitempty,gte=0"`
}

// UpdateMgaIndicatorRequest actualiza un indicador existente.
type UpdateMgaIndicatorRequest struct {
	Name                *string  `json:"name" validate:"omitempty,min=2,max=500"`
	Unit                *string  `json:"unit" validate:"omitempty,min=1,max=255"`
	Target              *float64 `json:"target" validate:"omitempty,gte=0"`
	SourceType          *string  `json:"source_type" validate:"omitempty,min=1,max=100"`
	VerificationSource  *string  `json:"verification_source" validate:"omitempty,min=2,max=2000"`
	SpecificObjectiveID *string  `json:"specific_objective_id" validate:"omitempty,uuid"`
	SortOrder           *int     `json:"sort_order" validate:"omitempty,gte=0"`
}

// MgaSpecificObjectiveResponse objetivo específico en respuestas API.
type MgaSpecificObjectiveResponse struct {
	ID          string `json:"id"`
	TenantID    string `json:"tenant_id"`
	ProjectID   string `json:"project_id"`
	CauseID     string `json:"cause_id"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// MgaCauseResponse causa con objetivo específico anidado.
type MgaCauseResponse struct {
	ID                string                        `json:"id"`
	TenantID          string                        `json:"tenant_id"`
	ProjectID         string                        `json:"project_id"`
	ParentID          *string                       `json:"parent_id,omitempty"`
	CauseType         string                        `json:"cause_type"`
	Description       string                        `json:"description"`
	SortOrder         int                           `json:"sort_order"`
	SpecificObjective *MgaSpecificObjectiveResponse `json:"specific_objective,omitempty"`
	CreatedAt         string                        `json:"created_at"`
	UpdatedAt         string                        `json:"updated_at"`
}

// MgaIndicatorResponse indicador de seguimiento.
type MgaIndicatorResponse struct {
	ID                  string  `json:"id"`
	TenantID            string  `json:"tenant_id"`
	ProjectID           string  `json:"project_id"`
	SpecificObjectiveID *string `json:"specific_objective_id,omitempty"`
	Name                string  `json:"name"`
	Unit                string  `json:"unit"`
	Target              float64 `json:"target"`
	SourceType          string  `json:"source_type"`
	VerificationSource  string  `json:"verification_source"`
	SortOrder           int     `json:"sort_order"`
	CreatedAt           string  `json:"created_at"`
	UpdatedAt           string  `json:"updated_at"`
}

// MgaFormulationResponse vista agregada para el frontend.
type MgaFormulationResponse struct {
	Causes     []MgaCauseResponse     `json:"causes"`
	Indicators []MgaIndicatorResponse `json:"indicators"`
}
