package handlers

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ListNeeds GET /projects/:id/mga/needs?alternative_id=
func (h *MgaHandler) ListNeeds(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	needs, err := h.repo.ListNeeds(c.Context(), projectID, tenantID, strings.TrimSpace(c.Query("alternative_id")))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list needs"})
	}

	out := make([]dto.MgaNeedResponse, 0, len(needs))
	for _, need := range needs {
		out = append(out, toMgaNeedResponse(need))
	}
	return c.JSON(out)
}

// CreateNeed POST /projects/:id/mga/needs
// Crea el registro padre y genera la grilla: una fila por año entre anio_inicial y
// ultimo_anio_proyectado. Si el cliente envía valores_anuales, se validan y se respetan.
func (h *MgaHandler) CreateNeed(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	var req dto.CreateMgaNeedRequest
	if err := parseAndValidateMgaBody(c, &req); err != nil {
		return err
	}

	if err := services.ValidateNeedYears(req.AnioInicial, req.AnioFinal, req.UltimoAnioProyectado); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	if err := h.ensureMeasurementUnit(c, req.UnidadMedidaID); err != nil {
		return err
	}

	series, err := services.NormalizeNeedSeries(req.AnioInicial, req.UltimoAnioProyectado, needValuesFromDTO(req.ValoresAnuales))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	rawSeries, err := services.MarshalNeedSeries(series)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to encode annual values"})
	}

	now := time.Now().UTC()
	need := &models.MgaNeed{
		ID:                   uuid.New(),
		TenantID:             tenantID,
		ProjectID:            projectID,
		AlternativeID:        strings.TrimSpace(req.AlternativeID),
		BienServicio:         strings.TrimSpace(req.BienServicio),
		Descripcion:          strings.TrimSpace(req.Descripcion),
		DescripcionOferta:    strings.TrimSpace(req.DescripcionOferta),
		DescripcionDemanda:   strings.TrimSpace(req.DescripcionDemanda),
		UnidadMedidaID:       req.UnidadMedidaID,
		AnioInicial:          req.AnioInicial,
		AnioFinal:            req.AnioFinal,
		UltimoAnioProyectado: req.UltimoAnioProyectado,
		ValoresAnuales:       rawSeries,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if err := h.repo.CreateNeed(c.Context(), need); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create need"})
	}

	return c.Status(fiber.StatusCreated).JSON(toMgaNeedResponse(*need))
}

// UpdateNeed PUT /projects/:id/mga/needs/:needId
// Si cambian los años la serie se redimensiona conservando los años que siguen en rango.
func (h *MgaHandler) UpdateNeed(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	needID, err := uuid.Parse(c.Params("needId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid need id"})
	}

	need, err := h.repo.FindNeed(c.Context(), needID, projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "need not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load need"})
	}

	var req dto.UpdateMgaNeedRequest
	if err := parseAndValidateMgaBody(c, &req); err != nil {
		return err
	}

	if req.BienServicio != nil {
		need.BienServicio = strings.TrimSpace(*req.BienServicio)
	}
	if req.Descripcion != nil {
		need.Descripcion = strings.TrimSpace(*req.Descripcion)
	}
	if req.DescripcionOferta != nil {
		need.DescripcionOferta = strings.TrimSpace(*req.DescripcionOferta)
	}
	if req.DescripcionDemanda != nil {
		need.DescripcionDemanda = strings.TrimSpace(*req.DescripcionDemanda)
	}
	if req.UnidadMedidaID != nil {
		if err := h.ensureMeasurementUnit(c, *req.UnidadMedidaID); err != nil {
			return err
		}
		need.UnidadMedidaID = *req.UnidadMedidaID
	}
	if req.AnioInicial != nil {
		need.AnioInicial = *req.AnioInicial
	}
	if req.AnioFinal != nil {
		need.AnioFinal = *req.AnioFinal
	}
	if req.UltimoAnioProyectado != nil {
		need.UltimoAnioProyectado = *req.UltimoAnioProyectado
	}

	if err := services.ValidateNeedYears(need.AnioInicial, need.AnioFinal, need.UltimoAnioProyectado); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var series []models.NeedAnnualValue
	if req.ValoresAnuales != nil {
		series, err = services.NormalizeNeedSeries(need.AnioInicial, need.UltimoAnioProyectado, needValuesFromDTO(*req.ValoresAnuales))
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
	} else {
		current, err := services.ParseNeedSeries(need.ValoresAnuales)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read annual values"})
		}
		series = services.ResizeNeedSeries(need.AnioInicial, need.UltimoAnioProyectado, current)
	}

	rawSeries, err := services.MarshalNeedSeries(series)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to encode annual values"})
	}
	need.ValoresAnuales = rawSeries
	need.UpdatedAt = time.Now().UTC()

	if err := h.repo.UpdateNeed(c.Context(), need); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update need"})
	}

	return c.JSON(toMgaNeedResponse(*need))
}

// UpdateNeedAnnualValue PUT /projects/:id/mga/needs/:needId/annual-values/:anio
// Guarda oferta/demanda de una fila de la grilla; el déficit (demanda - oferta) lo calcula el backend.
func (h *MgaHandler) UpdateNeedAnnualValue(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	needID, err := uuid.Parse(c.Params("needId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid need id"})
	}
	anio, err := strconv.Atoi(c.Params("anio"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid year"})
	}

	var req dto.UpdateMgaNeedAnnualValueRequest
	if err := parseAndValidateMgaBody(c, &req); err != nil {
		return err
	}

	need, err := h.repo.UpdateNeedAnnualValue(c.Context(), needID, projectID, tenantID, anio, *req.Oferta, *req.Demanda)
	if err != nil {
		switch {
		case isNotFound(err):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "need not found"})
		case errors.Is(err, services.ErrNeedYearNotInSeries):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "year not in need series"})
		default:
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update annual value"})
		}
	}

	return c.JSON(toMgaNeedResponse(*need))
}

// DeleteNeed DELETE /projects/:id/mga/needs/:needId
func (h *MgaHandler) DeleteNeed(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseMgaProjectContext(c)
	if err != nil {
		return err
	}

	needID, err := uuid.Parse(c.Params("needId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid need id"})
	}

	if err := h.repo.DeleteNeed(c.Context(), needID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "need not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete need"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// ensureMeasurementUnit responde 400 si la unidad de medida no existe en el catálogo.
func (h *MgaHandler) ensureMeasurementUnit(c *fiber.Ctx, unitID int) error {
	var count int64
	if err := h.db.WithContext(c.Context()).
		Model(&models.MeasurementUnit{}).
		Where("id = ?", unitID).
		Count(&count).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify measurement unit"})
	}
	if count == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unidad_medida_id not found"})
	}
	return nil
}

func needValuesFromDTO(in []dto.MgaNeedAnnualValueDTO) []models.NeedAnnualValue {
	out := make([]models.NeedAnnualValue, 0, len(in))
	for _, v := range in {
		out = append(out, models.NeedAnnualValue{Anio: v.Anio, Oferta: v.Oferta, Demanda: v.Demanda})
	}
	return out
}

func toMgaNeedResponse(need models.MgaNeed) dto.MgaNeedResponse {
	series, err := services.ParseNeedSeries(need.ValoresAnuales)
	if err != nil {
		series = []models.NeedAnnualValue{}
	}
	values := make([]dto.MgaNeedAnnualValueDTO, 0, len(series))
	for _, v := range series {
		values = append(values, dto.MgaNeedAnnualValueDTO{Anio: v.Anio, Oferta: v.Oferta, Demanda: v.Demanda, Deficit: v.Deficit})
	}

	return dto.MgaNeedResponse{
		ID:                   need.ID.String(),
		TenantID:             need.TenantID.String(),
		ProjectID:            need.ProjectID.String(),
		AlternativeID:        need.AlternativeID,
		BienServicio:         need.BienServicio,
		Descripcion:          need.Descripcion,
		DescripcionOferta:    need.DescripcionOferta,
		DescripcionDemanda:   need.DescripcionDemanda,
		UnidadMedidaID:       need.UnidadMedidaID,
		AnioInicial:          need.AnioInicial,
		AnioFinal:            need.AnioFinal,
		UltimoAnioProyectado: need.UltimoAnioProyectado,
		ValoresAnuales:       values,
		CreatedAt:            need.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:            need.UpdatedAt.UTC().Format(time.RFC3339),
	}
}
