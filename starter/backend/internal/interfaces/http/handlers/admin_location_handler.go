package handlers

import (
	"strconv"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// AdminLocationHandler gestiona la carga y consulta de localizaciones DANE
// y de los procesos MGA (verbos rectores DNP).
type AdminLocationHandler struct {
	db *gorm.DB
}

// NewAdminLocationHandler constructor.
func NewAdminLocationHandler(db *gorm.DB) *AdminLocationHandler {
	return &AdminLocationHandler{db: db}
}

// ─────────────────────────── Localizaciones ───────────────────────────

// ImportLocations recibe el JSON jerárquico Regiones→Departamentos→Municipios
// y ejecuta un upsert masivo dentro de una transacción.
// POST /api/v1/admin/locations/import
func (h *AdminLocationHandler) ImportLocations(c *fiber.Ctx) error {
	var req dto.LocationImportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid JSON body",
		})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	now := time.Now().UTC()
	resp := dto.LocationImportResponse{
		Status:  "success",
		Message: "Localizaciones importadas correctamente",
	}

	err := h.db.WithContext(c.Context()).Transaction(func(tx *gorm.DB) error {
		for _, regionDTO := range req.Localizaciones {
			region := models.Region{
				ID:        regionDTO.ID,
				Name:      regionDTO.Name,
				IsActive:  true,
				CreatedAt: now,
				UpdatedAt: now,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "id"}},
				DoUpdates: clause.AssignmentColumns([]string{"name", "updated_at"}),
			}).Create(&region).Error; err != nil {
				return err
			}
			resp.RegionsUpserted++

			for _, depDTO := range regionDTO.Departamentos {
				dep := models.Departamento{
					ID:        depDTO.ID,
					Name:      depDTO.Name,
					RegionID:  regionDTO.ID,
					IsActive:  true,
					CreatedAt: now,
					UpdatedAt: now,
				}
				if err := tx.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "id"}},
					DoUpdates: clause.AssignmentColumns([]string{"name", "region_id", "updated_at"}),
				}).Create(&dep).Error; err != nil {
					return err
				}
				resp.DepartamentosUpserted++

				for _, munDTO := range depDTO.Municipios {
					mun := models.Municipio{
						ID:             munDTO.ID,
						Name:           munDTO.Name,
						DepartamentoID: depDTO.ID,
						IsActive:       true,
						CreatedAt:      now,
						UpdatedAt:      now,
					}
					if err := tx.Clauses(clause.OnConflict{
						Columns:   []clause.Column{{Name: "id"}},
						DoUpdates: clause.AssignmentColumns([]string{"name", "departamento_id", "updated_at"}),
					}).Create(&mun).Error; err != nil {
						return err
					}
					resp.MunicipiosUpserted++
				}
			}
		}
		return nil
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to import locations",
			"details": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// ListLocations devuelve el árbol completo: regiones → departamentos → municipios.
// GET /api/v1/locations
func (h *AdminLocationHandler) ListLocations(c *fiber.Ctx) error {
	var regions []models.Region

	err := h.db.WithContext(c.Context()).
		Preload("Departamentos", func(db *gorm.DB) *gorm.DB {
			return db.Order("departamentos.name ASC")
		}).
		Preload("Departamentos.Municipios", func(db *gorm.DB) *gorm.DB {
			return db.Order("municipios.name ASC")
		}).
		Order("regiones.name ASC").
		Find(&regions).Error

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to list locations",
			"details": err.Error(),
		})
	}

	data := make([]dto.RegionResponse, 0, len(regions))
	for _, r := range regions {
		deps := make([]dto.DepartamentoResponse, 0, len(r.Departamentos))
		for _, d := range r.Departamentos {
			muns := make([]dto.MunicipioResponse, 0, len(d.Municipios))
			for _, m := range d.Municipios {
				muns = append(muns, dto.MunicipioResponse{
					ID:             m.ID,
					Name:           m.Name,
					DepartamentoID: m.DepartamentoID,
				})
			}
			deps = append(deps, dto.DepartamentoResponse{
				ID:         d.ID,
				Name:       d.Name,
				RegionID:   d.RegionID,
				Municipios: muns,
			})
		}
		data = append(data, dto.RegionResponse{
			ID:            r.ID,
			Name:          r.Name,
			Departamentos: deps,
		})
	}

	return c.JSON(fiber.Map{"data": data})
}

// ListAdminLocations devuelve listas paginadas para administración según el query param "type".
// GET /api/v1/admin/locations
func (h *AdminLocationHandler) ListAdminLocations(c *fiber.Ctx) error {
	locType := c.Query("type", "regiones") // regiones, departamentos, municipios
	search := c.Query("search")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	if limit < 1 || limit > 100 {
		limit = 10
	}
	offset := (page - 1) * limit

	var totalRecords int64
	var data interface{}

	switch locType {
	case "departamentos":
		query := h.db.WithContext(c.Context()).Model(&models.Departamento{})
		if search != "" {
			query = query.Where("name ILIKE ?", "%"+search+"%")
		}
		if err := query.Count(&totalRecords).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		var deps []models.Departamento
		if err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&deps).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		data = deps
	case "municipios":
		query := h.db.WithContext(c.Context()).Model(&models.Municipio{})
		if search != "" {
			query = query.Where("name ILIKE ?", "%"+search+"%")
		}
		if err := query.Count(&totalRecords).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		var muns []models.Municipio
		if err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&muns).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		data = muns
	case "tipos_agrupacion":
		query := h.db.WithContext(c.Context()).Model(&models.TipoAgrupacion{})
		if search != "" {
			query = query.Where("name ILIKE ?", "%"+search+"%")
		}
		if err := query.Count(&totalRecords).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		var tipos []models.TipoAgrupacion
		if err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&tipos).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		data = tipos
	case "agrupaciones":
		query := h.db.WithContext(c.Context()).Model(&models.Agrupacion{})
		if search != "" {
			query = query.Where("name ILIKE ?", "%"+search+"%")
		}
		if err := query.Count(&totalRecords).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		var agrups []models.Agrupacion
		if err := query.Preload("Municipio").Preload("TipoAgrupacion").Order("name ASC").Offset(offset).Limit(limit).Find(&agrups).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		data = agrups
	default: // regiones
		query := h.db.WithContext(c.Context()).Model(&models.Region{})
		if search != "" {
			query = query.Where("name ILIKE ?", "%"+search+"%")
		}
		if err := query.Count(&totalRecords).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		var regs []models.Region
		if err := query.Order("name ASC").Offset(offset).Limit(limit).Find(&regs).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		data = regs
	}

	totalPages := int((totalRecords + int64(limit) - 1) / int64(limit))
	if totalPages == 0 {
		totalPages = 1
	}

	meta := dto.PaginationMeta{
		Page:     page,
		LastPage: totalPages,
		Total:    totalRecords,
		Limit:    limit,
	}

	return c.JSON(fiber.Map{
		"data": data,
		"meta": meta,
	})
}

// ─────────────────────────── CRUD Individual ───────────────────────────

// CreateRegion
func (h *AdminLocationHandler) CreateRegion(c *fiber.Ctx) error {
	var req struct {
		ID   int    `json:"id" validate:"required"`
		Name string `json:"name" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	now := time.Now().UTC()
	region := models.Region{ID: req.ID, Name: req.Name, IsActive: true, CreatedAt: now, UpdatedAt: now}
	if err := h.db.WithContext(c.Context()).Create(&region).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(region)
}

// UpdateRegion
func (h *AdminLocationHandler) UpdateRegion(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var req struct {
		Name string `json:"name" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if err := h.db.WithContext(c.Context()).Model(&models.Region{}).Where("id = ?", id).Update("name", req.Name).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "updated"})
}

// ToggleRegion
func (h *AdminLocationHandler) ToggleRegion(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var r models.Region
	if err := h.db.WithContext(c.Context()).First(&r, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	r.IsActive = !r.IsActive
	if err := h.db.WithContext(c.Context()).Save(&r).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "updated", "is_active": r.IsActive})
}

// CreateDepartamento
func (h *AdminLocationHandler) CreateDepartamento(c *fiber.Ctx) error {
	var req struct {
		ID       int    `json:"id" validate:"required"`
		Name     string `json:"name" validate:"required"`
		RegionID int    `json:"region_id" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	now := time.Now().UTC()
	dep := models.Departamento{ID: req.ID, Name: req.Name, RegionID: req.RegionID, IsActive: true, CreatedAt: now, UpdatedAt: now}
	if err := h.db.WithContext(c.Context()).Create(&dep).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(dep)
}

// UpdateDepartamento
func (h *AdminLocationHandler) UpdateDepartamento(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var req struct {
		Name string `json:"name" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if err := h.db.WithContext(c.Context()).Model(&models.Departamento{}).Where("id = ?", id).Update("name", req.Name).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "updated"})
}

// ToggleDepartamento
func (h *AdminLocationHandler) ToggleDepartamento(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var r models.Departamento
	if err := h.db.WithContext(c.Context()).First(&r, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	r.IsActive = !r.IsActive
	if err := h.db.WithContext(c.Context()).Save(&r).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "updated", "is_active": r.IsActive})
}

// CreateMunicipio
func (h *AdminLocationHandler) CreateMunicipio(c *fiber.Ctx) error {
	var req struct {
		ID             int    `json:"id" validate:"required"`
		Name           string `json:"name" validate:"required"`
		DepartamentoID int    `json:"departamento_id" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	now := time.Now().UTC()
	mun := models.Municipio{ID: req.ID, Name: req.Name, DepartamentoID: req.DepartamentoID, IsActive: true, CreatedAt: now, UpdatedAt: now}
	if err := h.db.WithContext(c.Context()).Create(&mun).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(mun)
}

// UpdateMunicipio
func (h *AdminLocationHandler) UpdateMunicipio(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var req struct {
		Name string `json:"name" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if err := h.db.WithContext(c.Context()).Model(&models.Municipio{}).Where("id = ?", id).Update("name", req.Name).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "updated"})
}

// ToggleMunicipio
func (h *AdminLocationHandler) ToggleMunicipio(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var r models.Municipio
	if err := h.db.WithContext(c.Context()).First(&r, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	r.IsActive = !r.IsActive
	if err := h.db.WithContext(c.Context()).Save(&r).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "updated", "is_active": r.IsActive})
}

// ─────────────────────────── Tipos de Agrupación CRUD ───────────────────────────

// CreateTipoAgrupacion
func (h *AdminLocationHandler) CreateTipoAgrupacion(c *fiber.Ctx) error {
	var req struct {
		ID   int    `json:"id"`
		Name string `json:"name" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	now := time.Now().UTC()
	item := models.TipoAgrupacion{
		ID:        req.ID,
		Name:      req.Name,
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := h.db.WithContext(c.Context()).Create(&item).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

// UpdateTipoAgrupacion
func (h *AdminLocationHandler) UpdateTipoAgrupacion(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var req struct {
		Name string `json:"name" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if err := h.db.WithContext(c.Context()).Model(&models.TipoAgrupacion{}).Where("id = ?", id).Update("name", req.Name).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "updated"})
}

// ToggleTipoAgrupacion
func (h *AdminLocationHandler) ToggleTipoAgrupacion(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var r models.TipoAgrupacion
	if err := h.db.WithContext(c.Context()).First(&r, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	r.IsActive = !r.IsActive
	if err := h.db.WithContext(c.Context()).Save(&r).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "updated", "is_active": r.IsActive})
}

// ─────────────────────────── Agrupaciones CRUD ───────────────────────────

// CreateAgrupacion
func (h *AdminLocationHandler) CreateAgrupacion(c *fiber.Ctx) error {
	var req struct {
		ID               int    `json:"id"`
		Name             string `json:"name" validate:"required"`
		MunicipioID      int    `json:"municipio_id" validate:"required"`
		TipoAgrupacionID int    `json:"tipo_agrupacion_id" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	now := time.Now().UTC()
	item := models.Agrupacion{
		ID:               req.ID,
		Name:             req.Name,
		MunicipioID:      req.MunicipioID,
		TipoAgrupacionID: req.TipoAgrupacionID,
		IsActive:         true,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := h.db.WithContext(c.Context()).Create(&item).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

// UpdateAgrupacion
func (h *AdminLocationHandler) UpdateAgrupacion(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var req struct {
		Name             string `json:"name" validate:"required"`
		MunicipioID      int    `json:"municipio_id"`
		TipoAgrupacionID int    `json:"tipo_agrupacion_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	updates := map[string]interface{}{
		"name":       req.Name,
		"updated_at": time.Now().UTC(),
	}
	if req.MunicipioID > 0 {
		updates["municipio_id"] = req.MunicipioID
	}
	if req.TipoAgrupacionID > 0 {
		updates["tipo_agrupacion_id"] = req.TipoAgrupacionID
	}
	if err := h.db.WithContext(c.Context()).Model(&models.Agrupacion{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "updated"})
}

// ToggleAgrupacion
func (h *AdminLocationHandler) ToggleAgrupacion(c *fiber.Ctx) error {
	id, _ := c.ParamsInt("id")
	var r models.Agrupacion
	if err := h.db.WithContext(c.Context()).First(&r, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
	}
	r.IsActive = !r.IsActive
	if err := h.db.WithContext(c.Context()).Save(&r).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"status": "updated", "is_active": r.IsActive})
}

// ─────────────────────────── Consultas Autenticadas ───────────────────────────

// ListTiposAgrupacion devuelve el listado de tipos de agrupación étnica activos.
// GET /api/v1/locations/tipos-agrupacion
func (h *AdminLocationHandler) ListTiposAgrupacion(c *fiber.Ctx) error {
	var items []models.TipoAgrupacion
	if err := h.db.WithContext(c.Context()).Where("is_active = ?", true).Order("name ASC").Find(&items).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": items})
}

// ListAgrupaciones devuelve las agrupaciones étnicas activas, filtrables opcionalmente por municipio_id y tipo_agrupacion_id.
// GET /api/v1/locations/agrupaciones
func (h *AdminLocationHandler) ListAgrupaciones(c *fiber.Ctx) error {
	query := h.db.WithContext(c.Context()).Where("is_active = ?", true)
	if munID, err := strconv.Atoi(c.Query("municipio_id")); err == nil && munID > 0 {
		query = query.Where("municipio_id = ?", munID)
	}
	if tipoID, err := strconv.Atoi(c.Query("tipo_agrupacion_id")); err == nil && tipoID > 0 {
		query = query.Where("tipo_agrupacion_id = ?", tipoID)
	}
	var items []models.Agrupacion
	if err := query.Order("name ASC").Find(&items).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"data": items})
}


