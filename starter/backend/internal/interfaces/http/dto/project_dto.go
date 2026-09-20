package dto

// CreateProjectRequest payload para iniciar formulación de un proyecto.
// tenant_id y creator_id NO se aceptan aquí: salen del JWT.
//
// Clasificación programática DNP: sector → programa → producto.
type CreateProjectRequest struct {
	Name        string  `json:"name" validate:"required,min=3,max=500"`
	Description string  `json:"description" validate:"omitempty,max=5000"`
	CodeBPIN    *string `json:"code_bpin" validate:"omitempty,min=1,max=50"`
	Sector      string                 `json:"sector" binding:"required" validate:"required,min=2,max=255"`
	SectorID    *string                `json:"sector_id" binding:"required" validate:"required,uuid"`
	ProgramCode *string                `json:"program_code" validate:"omitempty,max=50"`
	ProductCode *string                `json:"product_code" binding:"required" validate:"required,max=50"`
	ProcesoID   int                    `json:"proceso_id" binding:"required" validate:"required"`
	Objeto      string                 `json:"objeto" binding:"required" validate:"required,min=10,max=1000"`
	Localizaciones []LocationSelectionDTO `json:"localizaciones" binding:"required,min=1" validate:"required,min=1,dive"`
	TipoInversion  string                 `json:"tipo_inversion" binding:"required" validate:"required"`
	Tipologia      string                 `json:"tipologia" binding:"required" validate:"required"`
	MgaFormulationData *map[string]interface{} `json:"mga_formulation_data,omitempty"`
}

// LocationSelectionDTO representa una selección de localización en la creación del proyecto.
type LocationSelectionDTO struct {
	RegionID       *int `json:"regionId"`
	DepartamentoID *int `json:"departamentoId"`
	MunicipioID    *int `json:"municipioId"`
}

// UpdateProjectDetailsRequest campos de formulación MGA.
type UpdateProjectDetailsRequest struct {
	ProblemDescription string `json:"problem_description" validate:"omitempty,max=10000"`
	GeneralObjective   string `json:"general_objective" validate:"omitempty,max=10000"`
	SituacionExistente string `json:"situacion_existente" validate:"omitempty,max=10000"`
	MagnitudProblema   string `json:"magnitud_problema" validate:"omitempty,max=10000"`
}

// ProjectResponse representación de salida.
type ProjectResponse struct {
	ID                 string  `json:"id"`
	TenantID           string  `json:"tenant_id"`
	CreatorID          string  `json:"creator_id"`
	Name               string  `json:"name"`
	Description        string  `json:"description,omitempty"`
	CodeBPIN           *string `json:"code_bpin,omitempty"`
	Sector             string  `json:"sector,omitempty"`
	SectorID           *string `json:"sector_id,omitempty"`
	ProgramCode        *string `json:"program_code,omitempty"`
	ProductCode        *string `json:"product_code,omitempty"`
	ProblemDescription string  `json:"problem_description,omitempty"`
	GeneralObjective   string  `json:"general_objective,omitempty"`
	SituacionExistente string  `json:"situacion_existente,omitempty"`
	MagnitudProblema   string  `json:"magnitud_problema,omitempty"`
	MgaFormulationData *map[string]interface{} `json:"mga_formulation_data,omitempty"`
	Status             string                     `json:"status"`
	CreatedAt          string                     `json:"created_at"`
	UpdatedAt          string                     `json:"updated_at"`
}

// PatchProjectRequest permite actualización parcial asíncrona de campos.
type PatchProjectRequest struct {
	Name               *string                 `json:"name,omitempty" validate:"omitempty,min=3,max=500"`
	Description        *string                 `json:"description,omitempty" validate:"omitempty,max=5000"`
	ProblemDescription *string                 `json:"problem_description,omitempty" validate:"omitempty,max=10000"`
	GeneralObjective   *string                 `json:"general_objective,omitempty" validate:"omitempty,max=10000"`
	SituacionExistente *string                 `json:"situacion_existente,omitempty" validate:"omitempty,max=10000"`
	MagnitudProblema   *string                 `json:"magnitud_problema,omitempty" validate:"omitempty,max=10000"`
	MgaFormulationData *map[string]interface{} `json:"mga_formulation_data,omitempty"`
}

// PaginatedProjectsResponse listado con paginación.
type PaginatedProjectsResponse struct {
	Data       []ProjectResponse `json:"data"`
	Page       int               `json:"page"`
	PageSize   int               `json:"page_size"`
	Total      int64             `json:"total"`
	TotalPages int               `json:"total_pages"`
}
