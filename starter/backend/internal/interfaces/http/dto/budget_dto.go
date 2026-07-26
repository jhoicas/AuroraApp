package dto

// CreateBudgetItemRequest payload para agregar un ítem de presupuesto.
// tenant_id y project_id NO se aceptan del body de aislamiento: salen del JWT / ruta.
type CreateBudgetItemRequest struct {
	Description string  `json:"description" validate:"required,min=2,max=2000"`
	Amount      float64 `json:"amount" validate:"required,gt=0"`
	ProductID   *string `json:"product_id" validate:"omitempty,uuid"`
}

// BudgetItemResponse representación de salida.
type BudgetItemResponse struct {
	ID          string  `json:"id"`
	TenantID    string  `json:"tenant_id"`
	ProjectID   string  `json:"project_id"`
	ProductID   *string `json:"product_id,omitempty"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}
