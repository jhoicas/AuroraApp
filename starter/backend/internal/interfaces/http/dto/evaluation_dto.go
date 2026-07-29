package dto

type EvaluateProjectRequest struct {
	DiscountRate float64                    `json:"discount_rate" validate:"required,gte=0,lte=1"`
	Alternatives []EvaluateAlternativeInput `json:"alternatives" validate:"required,min=1,dive"`
}

type EvaluateAlternativeInput struct {
	Name      string    `json:"name" validate:"required,min=1,max=255"`
	CashFlows []float64 `json:"cash_flows" validate:"required,min=2,dive"`
}

type EvaluateProjectResponse struct {
	ProjectID   string                `json:"project_id"`
	Evaluations []EvaluationResultDTO `json:"evaluations"`
}

type EvaluationResultDTO struct {
	AlternativeName string    `json:"alternative_name"`
	DiscountRate    float64   `json:"discount_rate"`
	CashFlows       []float64 `json:"cash_flows"`
	VPN             float64   `json:"vpn"`
	TIR             *float64  `json:"tir,omitempty"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required,min=10"`
}

type RefreshTokenResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
}

type TelemetryLogRequest struct {
	Action string `json:"action" validate:"required,min=1,max=80"`
}

type AuditUsageLogItem struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	Role      string `json:"role"`
	Action    string `json:"action"`
	CreatedAt string `json:"created_at"`
}

type AuditChatMessageItem struct {
	ID           string `json:"id"`
	UserID       string `json:"user_id"`
	Role         string `json:"role"`
	Content      string `json:"content"`
	Model        string `json:"model,omitempty"`
	RouteContext string `json:"route_context,omitempty"`
	CreatedAt    string `json:"created_at"`
}

type PaginatedAuditResponse[T any] struct {
	Data       []T   `json:"data"`
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}
