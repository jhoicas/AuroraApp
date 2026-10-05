package dto

// --- Necesidades (bien o servicio + serie anual oferta/demanda) ---

// MgaNeedAnnualValueDTO fila anual. En la entrada, deficit se ignora: el backend lo recalcula.
type MgaNeedAnnualValueDTO struct {
	Anio    int     `json:"anio" validate:"gte=1900,lte=2100"`
	Oferta  float64 `json:"oferta" validate:"gte=0"`
	Demanda float64 `json:"demanda" validate:"gte=0"`
	Deficit float64 `json:"deficit"`
}

type CreateMgaNeedRequest struct {
	AlternativeID        string                  `json:"alternative_id" validate:"required,max=64"`
	BienServicio         string                  `json:"bien_servicio" validate:"required,min=2,max=200"`
	Descripcion          string                  `json:"descripcion" validate:"max=500"`
	DescripcionOferta    string                  `json:"descripcion_oferta" validate:"max=500"`
	DescripcionDemanda   string                  `json:"descripcion_demanda" validate:"max=500"`
	UnidadMedidaID       int                     `json:"unidad_medida_id" validate:"required,gt=0"`
	AnioInicial          int                     `json:"anio_inicial" validate:"required,gte=1900,lte=2100"`
	AnioFinal            int                     `json:"anio_final" validate:"required,gte=1900,lte=2100"`
	UltimoAnioProyectado int                     `json:"ultimo_anio_proyectado" validate:"required,gte=1900,lte=2100"`
	ValoresAnuales       []MgaNeedAnnualValueDTO `json:"valores_anuales" validate:"omitempty,max=100,dive"`
}

// UpdateMgaNeedRequest actualización parcial. Si cambian los años, la serie se redimensiona
// conservando los valores de los años que siguen en el rango.
type UpdateMgaNeedRequest struct {
	BienServicio         *string                  `json:"bien_servicio" validate:"omitempty,min=2,max=200"`
	Descripcion          *string                  `json:"descripcion" validate:"omitempty,max=500"`
	DescripcionOferta    *string                  `json:"descripcion_oferta" validate:"omitempty,max=500"`
	DescripcionDemanda   *string                  `json:"descripcion_demanda" validate:"omitempty,max=500"`
	UnidadMedidaID       *int                     `json:"unidad_medida_id" validate:"omitempty,gt=0"`
	AnioInicial          *int                     `json:"anio_inicial" validate:"omitempty,gte=1900,lte=2100"`
	AnioFinal            *int                     `json:"anio_final" validate:"omitempty,gte=1900,lte=2100"`
	UltimoAnioProyectado *int                     `json:"ultimo_anio_proyectado" validate:"omitempty,gte=1900,lte=2100"`
	ValoresAnuales       *[]MgaNeedAnnualValueDTO `json:"valores_anuales" validate:"omitempty,max=100,dive"`
}

// UpdateMgaNeedAnnualValueRequest guardado de una sola fila (año) de la grilla.
type UpdateMgaNeedAnnualValueRequest struct {
	Oferta  *float64 `json:"oferta" validate:"required,gte=0"`
	Demanda *float64 `json:"demanda" validate:"required,gte=0"`
}

type MgaNeedResponse struct {
	ID                   string                  `json:"id"`
	TenantID             string                  `json:"tenant_id"`
	ProjectID            string                  `json:"project_id"`
	AlternativeID        string                  `json:"alternative_id"`
	BienServicio         string                  `json:"bien_servicio"`
	Descripcion          string                  `json:"descripcion"`
	DescripcionOferta    string                  `json:"descripcion_oferta"`
	DescripcionDemanda   string                  `json:"descripcion_demanda"`
	UnidadMedidaID       int                     `json:"unidad_medida_id"`
	AnioInicial          int                     `json:"anio_inicial"`
	AnioFinal            int                     `json:"anio_final"`
	UltimoAnioProyectado int                     `json:"ultimo_anio_proyectado"`
	ValoresAnuales       []MgaNeedAnnualValueDTO `json:"valores_anuales"`
	CreatedAt            string                  `json:"created_at"`
	UpdatedAt            string                  `json:"updated_at"`
}
