package dto

// ActionCard tarjeta de acción de 1-clic devuelta por Aurora Asistente.
// Tipos: mga_apply, mga_generate_project, catalog_search, navigate.
// Las tarjetas legacy (solo catalog+code) se normalizan a catalog_search en el parser.
type ActionCard struct {
	Type        string                 `json:"type,omitempty"`
	Catalog     string                 `json:"catalog,omitempty"`
	Code        string                 `json:"code,omitempty"`
	Label       string                 `json:"label"`
	Description string                 `json:"description,omitempty"`
	Payload     map[string]interface{} `json:"payload,omitempty"`
}

// AuroraChatProjectContext campos MGA de identificación usados para RAG en causas/efectos.
type AuroraChatProjectContext struct {
	ProblemDescription string `json:"problem_description" validate:"omitempty,max=8000"`
	SituacionExistente string `json:"situacion_existente" validate:"omitempty,max=8000"`
	MagnitudProblema   string `json:"magnitud_problema" validate:"omitempty,max=8000"`
}

// AuroraChatCreationContext catálogos e idea inicial para la entrevista de creación de proyecto.
type AuroraChatCreationContext struct {
	IdeaSummary  string   `json:"idea_summary" validate:"omitempty,max=8000"`
	SectorCode   string   `json:"sector_code" validate:"omitempty,max=64"`
	SectorName   string   `json:"sector_name" validate:"omitempty,max=255"`
	ProductCodes []string `json:"product_codes" validate:"omitempty,dive,max=64"`
	ProgramCodes []string `json:"program_codes" validate:"omitempty,dive,max=64"`
	OdsCodes     []string `json:"ods_codes" validate:"omitempty,dive,max=32"`
}

type AuroraChatRequest struct {
	Message         string                     `json:"message" validate:"required,min=1,max=8000"`
	RouteContext    string                     `json:"route_context" validate:"omitempty,max=4000"`
	SessionID       string                     `json:"session_id" validate:"omitempty,max=64"`
	ProjectContext  *AuroraChatProjectContext  `json:"project_context,omitempty"`
	CreationContext *AuroraChatCreationContext `json:"creation_context,omitempty"`
}

type AuroraChatResponse struct {
	Reply       string       `json:"reply"`
	ActionCards []ActionCard `json:"action_cards"`
	Model       string       `json:"model"`
	SessionID   string       `json:"session_id"`
	UserMsgID   string       `json:"user_message_id"`
	AssistantID string       `json:"assistant_message_id"`
}
