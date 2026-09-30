package dto

// ──────────────────────────────────────────────
// Importación masiva de localizaciones (JSON)
// ──────────────────────────────────────────────

// LocationImportRequest carga masiva jerárquica: Regiones → Departamentos → Municipios.
type LocationImportRequest struct {
	Localizaciones []LocationRegionDTO `json:"Localizaciones" validate:"required,min=1,dive"`
}

type LocationRegionDTO struct {
	ID          int                       `json:"Id"`
	Name        string                    `json:"Name" validate:"required,min=1"`
	Departments []LocationDepartamentoDTO `json:"Departments"`
}

type LocationDepartamentoDTO struct {
	ID             int                    `json:"Id"`
	Name           string                 `json:"Name" validate:"required,min=1"`
	Municipalities []LocationMunicipioDTO `json:"Municipalities"`
}

type LocationMunicipioDTO struct {
	ID            int                       `json:"Id"`
	Name          string                    `json:"Name" validate:"required,min=1"`
	GroupingTypes []LocationGroupingTypeDTO `json:"GroupingTypes"`
}

type LocationGroupingTypeDTO struct {
	ID        int                   `json:"Id"`
	Name      string                `json:"Name"`
	Groupings []LocationGroupingDTO `json:"Groupings"`
}

type LocationGroupingDTO struct {
	ID   int    `json:"Id"`
	Name string `json:"Name"`
}

// LocationImportResponse resultado de la importación masiva.
type LocationImportResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// ──────────────────────────────────────────────
// Lectura de localizaciones (árbol completo)
// ──────────────────────────────────────────────

// MunicipioResponse municipio para el frontend.
type MunicipioResponse struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	DepartamentoID  int    `json:"departamento_id"`
}

// DepartamentoResponse departamento con municipios anidados.
type DepartamentoResponse struct {
	ID         int                 `json:"id"`
	Name       string              `json:"name"`
	RegionID   int                 `json:"region_id"`
	Municipios []MunicipioResponse `json:"municipios"`
}

// RegionResponse región con departamentos anidados.
type RegionResponse struct {
	ID            int                     `json:"id"`
	Name          string                  `json:"name"`
	Departamentos []DepartamentoResponse  `json:"departamentos"`
}

// ──────────────────────────────────────────────
// Procesos MGA (verbos rectores DNP)
// ──────────────────────────────────────────────

// ProcesoResponse proceso para el frontend.
type ProcesoResponse struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// ProcesoImportRequest carga masiva de procesos.
type ProcesoImportRequest struct {
	Procesos []ProcesoDTO `json:"Procesos" validate:"required,min=1,dive"`
}

// ProcesoDTO un proceso dentro del JSON de importación.
type ProcesoDTO struct {
	ID   int    `json:"Id"`
	Name string `json:"Name" validate:"required,min=1"`
}

// ProcesoImportResponse resultado de la importación.
type ProcesoImportResponse struct {
	Status            string `json:"status"`
	Message           string `json:"message"`
	ProcesosUpserted  int    `json:"procesos_upserted"`
}
