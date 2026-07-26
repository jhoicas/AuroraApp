package dto

// ChatRequest payload para enviar un mensaje al asistente IA.
// tenant_id y user_id NO se aceptan: salen del JWT.
type ChatRequest struct {
	Message   string  `json:"message" validate:"required,min=1,max=8000"`
	ProjectID *string `json:"project_id" validate:"omitempty,uuid"`
}

// ChatResponse respuesta del endpoint de chat.
type ChatResponse struct {
	Reply              string  `json:"reply"`
	Model              string  `json:"model"`
	UserMessageID      string  `json:"user_message_id"`
	AssistantMessageID string  `json:"assistant_message_id"`
	ProjectID          *string `json:"project_id,omitempty"`
}

// AIMessageResponse un mensaje del historial.
type AIMessageResponse struct {
	ID        string  `json:"id"`
	Role      string  `json:"role"`
	Content   string  `json:"content"`
	Model     string  `json:"model,omitempty"`
	ProjectID *string `json:"project_id,omitempty"`
	CreatedAt string  `json:"created_at"`
}

// PaginatedAIMessagesResponse historial paginado.
type PaginatedAIMessagesResponse struct {
	Data       []AIMessageResponse `json:"data"`
	Page       int                 `json:"page"`
	PageSize   int                 `json:"page_size"`
	Total      int64               `json:"total"`
	TotalPages int                 `json:"total_pages"`
}
