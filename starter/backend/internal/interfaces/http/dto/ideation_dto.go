package dto

// IdeationChatRequest payload para el chat de ideación adaptativa pre-creación.
type IdeationChatRequest struct {
	Message   string `json:"message" validate:"required,min=1,max=8000"`
	SessionID string `json:"session_id" validate:"omitempty,max=64"`
}

// IdeationChatResponse respuesta del endpoint de ideación adaptativa.
// IsComplete indica que la entrevista fue cerrada y el frontend debe
// avanzar al formulario y solicitar sugerencias.
type IdeationChatResponse struct {
	Reply       string `json:"reply"`
	IsComplete  bool   `json:"is_complete"`
	SessionID   string `json:"session_id"`
	Model       string `json:"model"`
	UserMsgID   string `json:"user_message_id"`
	AssistantID string `json:"assistant_message_id"`
}
