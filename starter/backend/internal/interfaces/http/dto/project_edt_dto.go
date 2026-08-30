package dto

// --- Vínculo catálogo ---

type LinkCatalogRequest struct {
	ProductCode string `json:"product_code" validate:"required,min=1,max=50"`
}

type ProjectCatalogLinkResponse struct {
	ID          string `json:"id"`
	TenantID    string `json:"tenant_id"`
	ProjectID   string `json:"project_id"`
	ProductID   string `json:"product_id"`
	ProductCode string `json:"product_code"`
	Tipologia   string `json:"tipologia"`
	RequiresEdt bool   `json:"requires_edt"`
	SectorCode  string `json:"sector_code"`
	ProgramCode string `json:"program_code"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// --- Nodos EDT ---

type CreateEdtNodeRequest struct {
	CatalogEdtID *string `json:"catalog_edt_id" validate:"omitempty,uuid"`
	Code         string  `json:"code" validate:"required,min=1,max=100"`
	Level        int     `json:"level" validate:"required,gte=1,lte=10"`
	Name         string  `json:"name" validate:"required,min=2,max=2000"`
}

type UpdateEdtNodeRequest struct {
	CatalogEdtID *string `json:"catalog_edt_id" validate:"omitempty,uuid"`
	Code         *string `json:"code" validate:"omitempty,min=1,max=100"`
	Level        *int    `json:"level" validate:"omitempty,gte=1,lte=10"`
	Name         *string `json:"name" validate:"omitempty,min=2,max=2000"`
}

type ProjectEdtNodeResponse struct {
	ID           string  `json:"id"`
	TenantID     string  `json:"tenant_id"`
	ProjectID    string  `json:"project_id"`
	CatalogEdtID *string `json:"catalog_edt_id,omitempty"`
	Code         string  `json:"code"`
	Level        int     `json:"level"`
	Name         string  `json:"name"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

// --- Entregables ---

type CreateDeliverableRequest struct {
	ProjectEdtNodeID     string  `json:"project_edt_node_id" validate:"required,uuid"`
	CatalogDeliverableID *string `json:"catalog_deliverable_id" validate:"omitempty,uuid"`
	Code                 string  `json:"code" validate:"required,min=1,max=100"`
	Name                 string  `json:"name" validate:"required,min=2,max=2000"`
	Amount               float64 `json:"amount" validate:"gte=0"`
}

type UpdateDeliverableRequest struct {
	ProjectEdtNodeID     *string  `json:"project_edt_node_id" validate:"omitempty,uuid"`
	CatalogDeliverableID *string  `json:"catalog_deliverable_id" validate:"omitempty,uuid"`
	Code                 *string  `json:"code" validate:"omitempty,min=1,max=100"`
	Name                 *string  `json:"name" validate:"omitempty,min=2,max=2000"`
	Amount               *float64 `json:"amount" validate:"omitempty,gte=0"`
}

type ProjectDeliverableResponse struct {
	ID                   string  `json:"id"`
	TenantID             string  `json:"tenant_id"`
	ProjectID            string  `json:"project_id"`
	ProjectEdtNodeID     string  `json:"project_edt_node_id"`
	CatalogDeliverableID *string `json:"catalog_deliverable_id,omitempty"`
	Code                 string  `json:"code"`
	Name                 string  `json:"name"`
	Amount               float64 `json:"amount"`
	CreatedAt            string  `json:"created_at"`
	UpdatedAt            string  `json:"updated_at"`
}

// --- Actividades ---

type CreateActivityRequest struct {
	ProjectDeliverableID string  `json:"project_deliverable_id" validate:"required,uuid"`
	CatalogActivityID    *string `json:"catalog_activity_id" validate:"omitempty,uuid"`
	Code                 string  `json:"code" validate:"required,min=1,max=100"`
	Name                 string  `json:"name" validate:"required,min=2,max=2000"`
	Quantity             float64 `json:"quantity" validate:"gte=0"`
	UnitCost             float64 `json:"unit_cost" validate:"gte=0"`
}

type UpdateActivityRequest struct {
	ProjectDeliverableID *string  `json:"project_deliverable_id" validate:"omitempty,uuid"`
	CatalogActivityID    *string  `json:"catalog_activity_id" validate:"omitempty,uuid"`
	Code                 *string  `json:"code" validate:"omitempty,min=1,max=100"`
	Name                 *string  `json:"name" validate:"omitempty,min=2,max=2000"`
	Quantity             *float64 `json:"quantity" validate:"omitempty,gte=0"`
	UnitCost             *float64 `json:"unit_cost" validate:"omitempty,gte=0"`
	TotalCost            *float64 `json:"total_cost" validate:"omitempty,gte=0"`
}

type ProjectActivityResponse struct {
	ID                   string  `json:"id"`
	TenantID             string  `json:"tenant_id"`
	ProjectID            string  `json:"project_id"`
	ProjectDeliverableID string  `json:"project_deliverable_id"`
	CatalogActivityID    *string `json:"catalog_activity_id,omitempty"`
	Code                 string  `json:"code"`
	Name                 string  `json:"name"`
	Quantity             float64 `json:"quantity"`
	UnitCost             float64 `json:"unit_cost"`
	TotalCost            float64 `json:"total_cost"`
	CreatedAt            string  `json:"created_at"`
	UpdatedAt            string  `json:"updated_at"`
}

// EdtChainResponse agrupa el estado completo de la cadena de valor EDT de un proyecto.
type EdtChainResponse struct {
	CatalogLink  *ProjectCatalogLinkResponse  `json:"catalog_link,omitempty"`
	EdtNodes     []ProjectEdtNodeResponse     `json:"edt_nodes"`
	Deliverables []ProjectDeliverableResponse `json:"deliverables"`
	Activities   []ProjectActivityResponse    `json:"activities"`
}
