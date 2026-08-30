package dto

// ActionCard tarjeta de acción de 1-clic devuelta por Aurora Asistente.
// Tipos: mga_apply, catalog_search, navigate.
// Las tarjetas legacy (solo catalog+code) se normalizan a catalog_search en el parser.
type ActionCard struct {
	Type        string                 `json:"type,omitempty"`
	Catalog     string                 `json:"catalog,omitempty"`
	Code        string                 `json:"code,omitempty"`
	Label       string                 `json:"label"`
	Description string                 `json:"description,omitempty"`
	Payload     map[string]interface{} `json:"payload,omitempty"`
}

type AuroraChatRequest struct {
	Message      string `json:"message" validate:"required,min=1,max=8000"`
	RouteContext string `json:"route_context" validate:"omitempty,max=4000"`
	SessionID    string `json:"session_id" validate:"omitempty,max=64"`
}

type AuroraChatResponse struct {
	Reply       string       `json:"reply"`
	ActionCards []ActionCard `json:"action_cards"`
	Model       string       `json:"model"`
	SessionID   string       `json:"session_id"`
	UserMsgID   string       `json:"user_message_id"`
	AssistantID string       `json:"assistant_message_id"`
}
