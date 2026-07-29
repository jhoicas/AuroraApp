package dto

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
}

// RegisterRequest payload público para auto-registro de una institución + admin.
// El formato del email se valida en el handler con mail.ParseAddress (cualquier dominio válido).
type RegisterRequest struct {
	EntityName string `json:"entity_name" validate:"required,min=2,max=255"`
	NIT        string `json:"nit" validate:"required,min=5,max=50"`
	FullName   string `json:"full_name" validate:"required,min=2,max=255"`
	Email      string `json:"email" validate:"required,max=255"`
	Password   string `json:"password" validate:"required,min=6,max=72"`
}

type RegisterResponse struct {
	Message  string `json:"message"`
	TenantID string `json:"tenant_id"`
	Email    string `json:"email"`
}

type LoginUserResponse struct {
	ID       string  `json:"id"`
	Email    string  `json:"email"`
	FullName string  `json:"full_name"`
	Role     string  `json:"role"`
	TenantID *string `json:"tenant_id"`
}

type LoginResponse struct {
	Token        string            `json:"token"`
	RefreshToken string            `json:"refresh_token"`
	User         LoginUserResponse `json:"user"`
}
