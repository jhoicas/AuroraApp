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

// CreateProgramRequest alta manual de programa/subprograma (matriz DNP aplanada).
type CreateProgramRequest struct {
	CodigoSector      string `json:"codigo_sector" validate:"required,min=1,max=50"`
	NombreSector      string `json:"nombre_sector" validate:"omitempty,max=255"`
	CodigoPrograma    string `json:"codigo_programa" validate:"required,min=1,max=50"`
	NombrePrograma    string `json:"nombre_programa" validate:"required,min=1"`
	AmbitoAplicacion  string `json:"ambito_aplicacion" validate:"omitempty,max=2000"`
	CodigoSubprograma string `json:"codigo_subprograma" validate:"required,min=1,max=50"`
	NombreSubprograma string `json:"nombre_subprograma" validate:"required,min=1"`
	Observaciones     string `json:"observaciones" validate:"omitempty,max=5000"`
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

// CreateCatalogProductRequest alta manual de producto (matriz DNP aplanada).
type CreateCatalogProductRequest struct {
	Sector                  string `json:"sector" validate:"omitempty,max=50"`
	NombreSector            string `json:"nombre_sector" validate:"omitempty,max=255"`
	CodigoPrograma          string `json:"codigo_programa" validate:"required,min=1,max=50"`
	NombrePrograma          string `json:"nombre_programa" validate:"omitempty"`
	CodigoProducto          string `json:"codigo_producto" validate:"required,min=1,max=50"`
	Producto                string `json:"producto" validate:"required,min=1"`
	Descripcion             string `json:"descripcion" validate:"omitempty"`
	MedidoATravesDe         string `json:"medido_a_traves_de" validate:"omitempty"`
	CodigoIndicadorProducto string `json:"codigo_indicador_producto" validate:"omitempty,max=100"`
	IndicadorProducto       string `json:"indicador_producto" validate:"omitempty"`
	UnidadDeMedida          string `json:"unidad_de_medida" validate:"omitempty,max=255"`
	IndicadorPrincipal      bool   `json:"indicador_principal"`
	EsNacional              bool   `json:"es_nacional"`
	EsTerritorial           bool   `json:"es_territorial"`
	ODS                     string `json:"ods" validate:"omitempty"`
	MetaODS                 string `json:"meta_ods" validate:"omitempty"`
	TipologiaGeneralSUIFP   string `json:"tipologia_general_suifp" validate:"omitempty"`
	TipologiaD              bool   `json:"tipologia_d"`
	TipologiaE              bool   `json:"tipologia_e"`
	TipologiaAPIIP          bool   `json:"tipologia_a_piip"`
	TipologiaBPIIP          bool   `json:"tipologia_b_piip"`
	TipologiaCPIIP          bool   `json:"tipologia_c_piip"`
	TieneEDT                bool   `json:"tiene_edt"`
	EDT                     string `json:"edt" validate:"omitempty"`
}

// CatalogProductResponse fila del catálogo de productos DNP.
type CatalogProductResponse struct {
	ID                      string  `json:"id"`
	TenantID                *string `json:"tenant_id,omitempty"`
	Sector                  string  `json:"sector"`
	NombreSector            string  `json:"nombre_sector"`
	CodigoPrograma          string  `json:"codigo_programa"`
	NombrePrograma          string  `json:"nombre_programa"`
	CodigoProducto          string  `json:"codigo_producto"`
	Producto                string  `json:"producto"`
	Descripcion             string  `json:"descripcion"`
	MedidoATravesDe         string  `json:"medido_a_traves_de"`
	CodigoIndicadorProducto string  `json:"codigo_indicador_producto"`
	IndicadorProducto       string  `json:"indicador_producto"`
	UnidadDeMedida          string  `json:"unidad_de_medida"`
	IndicadorPrincipal      bool    `json:"indicador_principal"`
	EsNacional              bool    `json:"es_nacional"`
	EsTerritorial           bool    `json:"es_territorial"`
	ODS                     string  `json:"ods"`
	MetaODS                 string  `json:"meta_ods"`
	TipologiaGeneralSUIFP   string  `json:"tipologia_general_suifp"`
	TipologiaD              bool    `json:"tipologia_d"`
	TipologiaE              bool    `json:"tipologia_e"`
	TipologiaAPIIP          bool    `json:"tipologia_a_piip"`
	TipologiaBPIIP          bool    `json:"tipologia_b_piip"`
	TipologiaCPIIP          bool    `json:"tipologia_c_piip"`
	TieneEDT                bool    `json:"tiene_edt"`
	EDT                     string  `json:"edt"`
	CreatedAt               string  `json:"created_at"`
}

// PaginatedCatalogProductsResponse listado paginado de productos del catálogo.
type PaginatedCatalogProductsResponse struct {
	Data []CatalogProductResponse `json:"data"`
	Meta PaginationMeta           `json:"meta"`
}

// ImportRowError detalle de una fila omitida o inválida en importación masiva.
type ImportRowError struct {
	Row            int    `json:"row"`
	CodigoProducto string `json:"codigo_producto,omitempty"`
	Message        string `json:"message"`
}

// ProductImportResponse resultado de importación masiva de productos.
type ProductImportResponse struct {
	Status          string           `json:"status"`
	Message         string           `json:"message"`
	Inserted        int              `json:"inserted"`
	Updated         int              `json:"updated"`
	Skipped         int              `json:"skipped"`
	TotalRowsParsed int              `json:"total_rows_parsed"`
	Errors          []ImportRowError `json:"errors,omitempty"`
}

// CatalogEdtResponse fila del catálogo EDT.
type CatalogEdtResponse struct {
	ID                          string  `json:"id"`
	TenantID                    *string `json:"tenant_id,omitempty"`
	CodigoProductoEstandarizado string  `json:"codigo_producto_estandarizado"`
	NombreProducto              string  `json:"nombre_producto"`
	CodigoEntregableL1          string  `json:"codigo_entregable_l1"`
	NombreEntregableL1          string  `json:"nombre_entregable_l1"`
	CodigoEntregableL2          string  `json:"codigo_entregable_l2"`
	NombreEntregableL2          string  `json:"nombre_entregable_l2"`
	CodigoEntregableL3          string  `json:"codigo_entregable_l3"`
	NombreEntregableL3          string  `json:"nombre_entregable_l3"`
	CodigoActividad             string  `json:"codigo_actividad"`
	Actividad                   string  `json:"actividad"`
	UnidadDeMedida              string  `json:"unidad_de_medida"`
	CreatedAt                   string  `json:"created_at"`
}

// PaginatedCatalogEdtResponse listado paginado EDT.
type PaginatedCatalogEdtResponse struct {
	Data []CatalogEdtResponse `json:"data"`
	Meta PaginationMeta       `json:"meta"`
}

// EdtImportResponse resultado de importación masiva EDT.
type EdtImportResponse struct {
	Status          string           `json:"status"`
	Message         string           `json:"message"`
	Inserted        int              `json:"inserted"`
	Updated         int              `json:"updated"`
	Skipped         int              `json:"skipped"`
	TotalRowsParsed int              `json:"total_rows_parsed"`
	Errors          []ImportRowError `json:"errors,omitempty"`
}

// CatalogDeliverableResponse fila del catálogo de entregables.
type CatalogDeliverableResponse struct {
	ID                   string  `json:"id"`
	TenantID             *string `json:"tenant_id,omitempty"`
	CodigoEntregable     string  `json:"codigo_entregable"`
	ListadoDeEntregables string  `json:"listado_de_entregables"`
	CreatedAt            string  `json:"created_at"`
}

// PaginatedCatalogDeliverableResponse listado paginado de entregables.
type PaginatedCatalogDeliverableResponse struct {
	Data []CatalogDeliverableResponse `json:"data"`
	Meta PaginationMeta               `json:"meta"`
}

// DeliverableImportResponse resultado de importación masiva de entregables.
type DeliverableImportResponse struct {
	Status          string           `json:"status"`
	Message         string           `json:"message"`
	Inserted        int              `json:"inserted"`
	Updated         int              `json:"updated"`
	Skipped         int              `json:"skipped"`
	TotalRowsParsed int              `json:"total_rows_parsed"`
	Errors          []ImportRowError `json:"errors,omitempty"`
}

// CatalogActivityResponse fila del catálogo de actividades.
type CatalogActivityResponse struct {
	ID                   string  `json:"id"`
	TenantID             *string `json:"tenant_id,omitempty"`
	CodigoActividad      string  `json:"codigo_actividad"`
	ListadoDeActividades string  `json:"listado_de_actividades"`
	UnidadDeMedida       string  `json:"unidad_de_medida"`
	CreatedAt            string  `json:"created_at"`
}

// PaginatedCatalogActivityResponse listado paginado de actividades.
type PaginatedCatalogActivityResponse struct {
	Data []CatalogActivityResponse `json:"data"`
	Meta PaginationMeta            `json:"meta"`
}

// ActivityImportResponse resultado de importación masiva de actividades.
type ActivityImportResponse struct {
	Status          string           `json:"status"`
	Message         string           `json:"message"`
	Inserted        int              `json:"inserted"`
	Updated         int              `json:"updated"`
	Skipped         int              `json:"skipped"`
	TotalRowsParsed int              `json:"total_rows_parsed"`
	Errors          []ImportRowError `json:"errors,omitempty"`
}

// CatalogOdsResponse fila del catálogo ODS.
type CatalogOdsResponse struct {
	ID                     string  `json:"id"`
	TenantID               *string `json:"tenant_id,omitempty"`
	CodObjetivoOds         string  `json:"cod_objetivo_ods"`
	DescripcionObjetivoOds string  `json:"descripcion_objetivo_ods"`
	CodigoMetaOds          string  `json:"codigo_meta_ods"`
	DescripcionMetaOds     string  `json:"descripcion_meta_ods"`
	CreatedAt              string  `json:"created_at"`
}

// PaginatedCatalogOdsResponse listado paginado ODS.
type PaginatedCatalogOdsResponse struct {
	Data []CatalogOdsResponse `json:"data"`
	Meta PaginationMeta       `json:"meta"`
}

// OdsImportResponse resultado de importación masiva ODS.
type OdsImportResponse struct {
	Status          string           `json:"status"`
	Message         string           `json:"message"`
	Inserted        int              `json:"inserted"`
	Updated         int              `json:"updated"`
	Skipped         int              `json:"skipped"`
	TotalRowsParsed int              `json:"total_rows_parsed"`
	Errors          []ImportRowError `json:"errors,omitempty"`
}

// ProductResponse producto del catálogo DNP (tabla products, explorador).
type ProductResponse struct {
	ID        string  `json:"id"`
	ProgramID string  `json:"program_id"`
	Code      string  `json:"code"`
	CodeBPIN  *string `json:"code_bpin,omitempty"`
	Name      string  `json:"name"`
}

// PaginatedProductsResponse búsqueda de productos paginada (explorador DNP).
type PaginatedProductsResponse struct {
	Data       []ProductResponse `json:"data"`
	Page       int               `json:"page"`
	PageSize   int               `json:"page_size"`
	Total      int64             `json:"total"`
	TotalPages int               `json:"total_pages"`
	Query      string            `json:"q"`
}
