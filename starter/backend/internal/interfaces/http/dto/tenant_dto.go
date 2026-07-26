package dto

// CreateTenantRequest payload para registrar una entidad.
type CreateTenantRequest struct {
	Name         string  `json:"name" validate:"required,min=2,max=255"`
	NIT          string  `json:"nit" validate:"required,min=5,max=50"`
	Domain       *string `json:"domain" validate:"omitempty,min=3,max=255"`
	ContactEmail string  `json:"contact_email" validate:"required,email,max=255"`
}

// UpdateTenantStatusRequest payload para suspender/activar.
type UpdateTenantStatusRequest struct {
	Status string `json:"status" validate:"required,oneof=ACTIVE SUSPENDED"`
}

// TenantResponse representación de salida.
type TenantResponse struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	NIT          *string `json:"nit,omitempty"`
	Domain       *string `json:"domain,omitempty"`
	ContactEmail string  `json:"contact_email"`
	Status       string  `json:"status"`
	IsActive     bool    `json:"is_active"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

// PaginatedTenantsResponse listado con paginación.
type PaginatedTenantsResponse struct {
	Data       []TenantResponse `json:"data"`
	Page       int              `json:"page"`
	PageSize   int              `json:"page_size"`
	Total      int64            `json:"total"`
	TotalPages int              `json:"total_pages"`
}
