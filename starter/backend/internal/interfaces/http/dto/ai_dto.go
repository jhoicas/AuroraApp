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

// SuggestFieldRequest payload para el motor de sugerencias MGA.
type SuggestFieldRequest struct {
	FieldHelpKey   string                 `json:"field_help_key" validate:"required"`
	ProjectContext map[string]interface{} `json:"project_context" validate:"required"`
}

// SuggestFieldResponse respuesta del motor de sugerencias MGA.
type SuggestFieldResponse struct {
	Suggestion string `json:"suggestion"`
}

// SuggestProjectSetupRequest payload para el wizard pre-creación de proyecto.
type SuggestProjectSetupRequest struct {
	PreCreationContext []string               `json:"pre_creation_context" validate:"required"`
	CurrentFormData    map[string]interface{} `json:"current_form_data,omitempty"`
}

// ProjectSetupSuggestions sugerencias devueltas por el wizard
type ProjectSetupSuggestions struct {
	Nombre            []string    `json:"nombre"`
	Proceso           []string    `json:"proceso"`
	Objeto            []string    `json:"objeto"`
	Localizaciones    interface{} `json:"localizaciones"` // Slice of slice of location maps
	SectorId          []string    `json:"sector_id"`
	ProductoPrincipal []string    `json:"producto_principal"`
}

// SuggestProjectSetupResponse respuesta del wizard pre-creación
type SuggestProjectSetupResponse struct {
	Suggestions ProjectSetupSuggestions `json:"suggestions"`
}
