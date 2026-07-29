package dto

type AuroraChatRequest struct {
	Message      string `json:"message" validate:"required,min=1,max=8000"`
	RouteContext string `json:"route_context" validate:"omitempty,max=500"`
	SessionID    string `json:"session_id" validate:"omitempty,max=64"`
}

type ActionCard struct {
	Catalog     string `json:"catalog"`
	Code        string `json:"code"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
}

type AuroraChatResponse struct {
	Reply       string       `json:"reply"`
	ActionCards []ActionCard `json:"action_cards"`
	Model       string       `json:"model"`
	SessionID   string       `json:"session_id"`
	UserMsgID   string       `json:"user_message_id"`
	AssistantID string       `json:"assistant_message_id"`
}
