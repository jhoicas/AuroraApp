package handlers

import (
	"context"
	"encoding/json"
	"fmt"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/domain/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Regla de negocio de localización estricta: ver domain/services/location_rule.go.

// locationRuleViolation resultado de una validación fallida (status HTTP + mensaje).
type locationRuleViolation struct {
	status  int
	message string
}

func (v *locationRuleViolation) respond(c *fiber.Ctx) error {
	return c.Status(v.status).JSON(fiber.Map{"error": v.message})
}

// projectFormulationMap decodifica mga_formulation_data del proyecto (mapa vacío si no hay).
func projectFormulationMap(p *models.Project) map[string]interface{} {
	out := make(map[string]interface{})
	if p != nil && len(p.MgaFormulationData) > 0 {
		if err := json.Unmarshal(p.MgaFormulationData, &out); err != nil || out == nil {
			out = make(map[string]interface{})
		}
	}
	return out
}

// checkBaseDepartment valida que las referencias geográficas pertenezcan al departamento base:
//  1. ningún departamento explícito puede diferir del base;
//  2. todo municipio debe existir y pertenecer al departamento base.
//
// Sin base (proyecto sin localización registrada) o sin referencias no hay nada que validar.
func checkBaseDepartment(ctx context.Context, db *gorm.DB, base *services.BaseLocation, refs []services.LocationRef) *locationRuleViolation {
	if base == nil || len(refs) == 0 {
		return nil
	}

	if v := services.DepartmentViolation(base.DepartamentoID, refs); v != nil {
		return &locationRuleViolation{
			status: fiber.StatusBadRequest,
			message: fmt.Sprintf(
				"El departamento %d no corresponde al departamento base del proyecto (%d). Solo se permiten localizaciones dentro del departamento base.",
				*v.DepartamentoID, base.DepartamentoID),
		}
	}

	ids := services.MunicipalityIDs(refs)
	if len(ids) == 0 {
		return nil
	}
	var valid int64
	if err := db.WithContext(ctx).
		Model(&models.Municipio{}).
		Where("id IN ? AND departamento_id = ?", ids, base.DepartamentoID).
		Count(&valid).Error; err != nil {
		return &locationRuleViolation{status: fiber.StatusInternalServerError, message: "failed to verify municipalities"}
	}
	if int(valid) != len(ids) {
		return &locationRuleViolation{
			status: fiber.StatusBadRequest,
			message: fmt.Sprintf(
				"Uno o más municipios no pertenecen al departamento base del proyecto (%d).", base.DepartamentoID),
		}
	}
	return nil
}

// withBaseLocation fija en mga_formulation_data la localización base (clave reservada).
// Se usa al crear el proyecto: ignora cualquier valor enviado por el cliente y toma la primera
// localización con departamento. Si esa localización no trae región, se completa desde el catálogo.
func withBaseLocation(ctx context.Context, db *gorm.DB, data map[string]interface{}) {
	delete(data, services.BaseLocationKey)

	// ResolveBaseLocation trabaja sobre estructuras decodificadas de JSON ([]interface{}).
	raw, err := json.Marshal(data)
	if err != nil {
		return
	}
	var generic map[string]interface{}
	if err := json.Unmarshal(raw, &generic); err != nil {
		return
	}
	base := services.ResolveBaseLocation(generic)
	if base == nil {
		return
	}
	if base.RegionID == nil {
		var dep models.Departamento
		if err := db.WithContext(ctx).Select("id", "region_id").First(&dep, base.DepartamentoID).Error; err == nil {
			regionID := dep.RegionID
			base.RegionID = &regionID
		}
	}
	data[services.BaseLocationKey] = base.ToMap()
}
