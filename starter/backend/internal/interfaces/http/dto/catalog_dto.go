package dto

// SectorResponse sector del catálogo DNP.
type SectorResponse struct {
	ID           string `json:"id"`
	Code         string `json:"code"`
	Name         string `json:"name"`
	Application  string `json:"application"`
	Observations string `json:"observations"`
}

// CreateSectorRequest alta manual de un sector.
type CreateSectorRequest struct {
	Code         string `json:"code" validate:"required,min=1,max=50"`
	Name         string `json:"name" validate:"required,min=2,max=255"`
	Application  string `json:"application" validate:"omitempty,max=2000"`
	Observations string `json:"observations" validate:"omitempty,max=5000"`
}

// PaginationMeta metadatos de paginación para el frontend.
type PaginationMeta struct {
	Total    int64 `json:"total"`
	Page     int   `json:"page"`
	Limit    int   `json:"limit"`
	LastPage int   `json:"last_page"`
}

// PaginatedSectorsResponse listado paginado de sectores.
type PaginatedSectorsResponse struct {
	Data []SectorResponse `json:"data"`
	Meta PaginationMeta   `json:"meta"`
}

// SectorImportResponse resultado de importación masiva XLSX/CSV.
type SectorImportResponse struct {
	Status          string `json:"status"`
	Message         string `json:"message"`
	Inserted        int    `json:"inserted"`
	Updated         int    `json:"updated"`
	Skipped         int    `json:"skipped"`
	TotalRowsParsed int    `json:"total_rows_parsed"`
}

// ProgramSubprogramResponse fila del catálogo programas/subprogramas.
type ProgramSubprogramResponse struct {
	ID                string  `json:"id"`
	TenantID          *string `json:"tenant_id,omitempty"`
	SectorID          string  `json:"sector_id"`
	CodigoSector      string  `json:"codigo_sector"`
	NombreSector      string  `json:"nombre_sector"`
	CodigoPrograma    string  `json:"codigo_programa"`
	NombrePrograma    string  `json:"nombre_programa"`
	AmbitoAplicacion  string  `json:"ambito_aplicacion"`
	CodigoSubprograma string  `json:"codigo_subprograma"`
	NombreSubprograma string  `json:"nombre_subprograma"`
	Observaciones     string  `json:"observaciones"`
	CreatedAt         string  `json:"created_at"`
}

// PaginatedProgramsResponse listado paginado de programas/subprogramas.
type PaginatedProgramsResponse struct {
	Data []ProgramSubprogramResponse `json:"data"`
	Meta PaginationMeta              `json:"meta"`
}

// ProgramImportResponse resultado de importación masiva de programas.
type ProgramImportResponse struct {
	Status          string `json:"status"`
	Message         string `json:"message"`
	Inserted        int    `json:"inserted"`
	Updated         int    `json:"updated"`
	Skipped         int    `json:"skipped"`
	TotalRowsParsed int    `json:"total_rows_parsed"`
}

// ProgramResponse programa del catálogo DNP (tabla programs, por sector).
type ProgramResponse struct {
	ID       string `json:"id"`
	SectorID string `json:"sector_id"`
	Code     string `json:"code"`
	Name     string `json:"name"`
}

// ProductResponse producto del catálogo DNP.
type ProductResponse struct {
	ID        string  `json:"id"`
	ProgramID string  `json:"program_id"`
	Code      string  `json:"code"`
	CodeBPIN  *string `json:"code_bpin,omitempty"`
	Name      string  `json:"name"`
}

// PaginatedProductsResponse búsqueda de productos paginada.
type PaginatedProductsResponse struct {
	Data       []ProductResponse `json:"data"`
	Page       int               `json:"page"`
	PageSize   int               `json:"page_size"`
	Total      int64             `json:"total"`
	TotalPages int               `json:"total_pages"`
	Query      string            `json:"q"`
}
