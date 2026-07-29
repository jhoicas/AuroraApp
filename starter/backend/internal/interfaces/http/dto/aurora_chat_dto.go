package dto

type AuroraChatRequest struct {
	Message      string `json:"message" validate:"required,min=1,max=8000"`
	RouteContext string `json:"route_context"`
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
}
