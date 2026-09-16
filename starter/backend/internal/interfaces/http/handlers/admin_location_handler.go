package handlers

import (
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

// ─────────────────────────── Procesos MGA ───────────────────────────

// ImportProcesos carga masiva de verbos rectores MGA.
// POST /api/v1/admin/procesos/import
func (h *AdminLocationHandler) ImportProcesos(c *fiber.Ctx) error {
	var req dto.ProcesoImportRequest
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
	resp := dto.ProcesoImportResponse{
		Status:  "success",
		Message: "Procesos importados correctamente",
	}

	err := h.db.WithContext(c.Context()).Transaction(func(tx *gorm.DB) error {
		for _, p := range req.Procesos {
			proceso := models.Proceso{
				ID:        p.ID,
				Name:      p.Name,
				CreatedAt: now,
				UpdatedAt: now,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "id"}},
				DoUpdates: clause.AssignmentColumns([]string{"name", "updated_at"}),
			}).Create(&proceso).Error; err != nil {
				return err
			}
			resp.ProcesosUpserted++
		}
		return nil
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to import procesos",
			"details": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(resp)
}

// ListProcesos devuelve todos los verbos rectores MGA ordenados alfabéticamente.
// GET /api/v1/procesos
func (h *AdminLocationHandler) ListProcesos(c *fiber.Ctx) error {
	var procesos []models.Proceso

	err := h.db.WithContext(c.Context()).
		Order("name ASC").
		Find(&procesos).Error

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to list procesos",
			"details": err.Error(),
		})
	}

	data := make([]dto.ProcesoResponse, 0, len(procesos))
	for _, p := range procesos {
		data = append(data, dto.ProcesoResponse{
			ID:   p.ID,
			Name: p.Name,
		})
	}

	return c.JSON(fiber.Map{"data": data})
}
