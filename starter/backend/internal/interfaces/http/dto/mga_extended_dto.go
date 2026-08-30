package dto

import "encoding/json"

// --- Efectos ---

type CreateMgaEffectRequest struct {
	EffectType  string  `json:"effect_type" validate:"required,oneof=directo indirecto"`
	Description string  `json:"description" validate:"required,min=2,max=5000"`
	ParentID    *string `json:"parent_id" validate:"omitempty,uuid"`
	SortOrder   *int    `json:"sort_order" validate:"omitempty,gte=0"`
}

type UpdateMgaEffectRequest struct {
	EffectType  *string `json:"effect_type" validate:"omitempty,oneof=directo indirecto"`
	Description *string `json:"description" validate:"omitempty,min=2,max=5000"`
	ParentID    *string `json:"parent_id" validate:"omitempty,uuid"`
	SortOrder   *int    `json:"sort_order" validate:"omitempty,gte=0"`
}

type MgaEffectResponse struct {
	ID          string  `json:"id"`
	TenantID    string  `json:"tenant_id"`
	ProjectID   string  `json:"project_id"`
	ParentID    *string `json:"parent_id,omitempty"`
	EffectType  string  `json:"effect_type"`
	Description string  `json:"description"`
	SortOrder   int     `json:"sort_order"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

// --- Participantes ---

type CreateMgaParticipantRequest struct {
	Actor        string `json:"actor" validate:"required,min=2,max=500"`
	Entity       string `json:"entity" validate:"required,min=2,max=500"`
	Position     string `json:"position" validate:"required,min=2,max=100"`
	Interests    string `json:"interests" validate:"required,min=2,max=5000"`
	Contribution string `json:"contribution" validate:"required,min=2,max=5000"`
}

type UpdateMgaParticipantRequest struct {
	Actor        *string `json:"actor" validate:"omitempty,min=2,max=500"`
	Entity       *string `json:"entity" validate:"omitempty,min=2,max=500"`
	Position     *string `json:"position" validate:"omitempty,min=2,max=100"`
	Interests    *string `json:"interests" validate:"omitempty,min=2,max=5000"`
	Contribution *string `json:"contribution" validate:"omitempty,min=2,max=5000"`
}

type MgaParticipantResponse struct {
	ID           string `json:"id"`
	TenantID     string `json:"tenant_id"`
	ProjectID    string `json:"project_id"`
	Actor        string `json:"actor"`
	Entity       string `json:"entity"`
	Position     string `json:"position"`
	Interests    string `json:"interests"`
	Contribution string `json:"contribution"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// --- Población ---

type CreateMgaPopulationRequest struct {
	PopulationType string          `json:"population_type" validate:"required,oneof=afectada objetivo"`
	TotalNumber    int             `json:"total_number" validate:"gte=0"`
	Source         string          `json:"source" validate:"required,min=2,max=2000"`
	Locations      json.RawMessage `json:"locations" validate:"required"`
}

type UpdateMgaPopulationRequest struct {
	PopulationType *string          `json:"population_type" validate:"omitempty,oneof=afectada objetivo"`
	TotalNumber    *int             `json:"total_number" validate:"omitempty,gte=0"`
	Source         *string          `json:"source" validate:"omitempty,min=2,max=2000"`
	Locations      *json.RawMessage `json:"locations"`
}

type MgaPopulationResponse struct {
	ID             string          `json:"id"`
	TenantID       string          `json:"tenant_id"`
	ProjectID      string          `json:"project_id"`
	PopulationType string          `json:"population_type"`
	TotalNumber    int             `json:"total_number"`
	Source         string          `json:"source"`
	Locations      json.RawMessage `json:"locations"`
	CreatedAt      string          `json:"created_at"`
	UpdatedAt      string          `json:"updated_at"`
}

// --- Alternativas ---

type CreateMgaAlternativeRequest struct {
	Description           string `json:"description" validate:"required,min=2,max=5000"`
	EvaluateProfitability bool   `json:"evaluate_profitability"`
	EvaluateCost          bool   `json:"evaluate_cost"`
	ProceedsToPreparation bool   `json:"proceeds_to_preparation"`
}

type UpdateMgaAlternativeRequest struct {
	Description           *string `json:"description" validate:"omitempty,min=2,max=5000"`
	EvaluateProfitability *bool   `json:"evaluate_profitability"`
	EvaluateCost          *bool   `json:"evaluate_cost"`
	ProceedsToPreparation *bool   `json:"proceeds_to_preparation"`
}

type MgaAlternativeResponse struct {
	ID                    string `json:"id"`
	TenantID              string `json:"tenant_id"`
	ProjectID             string `json:"project_id"`
	Description           string `json:"description"`
	EvaluateProfitability bool   `json:"evaluate_profitability"`
	EvaluateCost          bool   `json:"evaluate_cost"`
	ProceedsToPreparation bool   `json:"proceeds_to_preparation"`
	CreatedAt             string `json:"created_at"`
	UpdatedAt             string `json:"updated_at"`
}

// FullMgaFormulationResponse consolidado de todo el estado MGA del proyecto.
type FullMgaFormulationResponse struct {
	Causes       []MgaCauseResponse       `json:"causes"`
	Effects      []MgaEffectResponse      `json:"effects"`
	Indicators   []MgaIndicatorResponse   `json:"indicators"`
	Participants []MgaParticipantResponse `json:"participants"`
	Populations  []MgaPopulationResponse  `json:"populations"`
	Alternatives []MgaAlternativeResponse `json:"alternatives"`
}
