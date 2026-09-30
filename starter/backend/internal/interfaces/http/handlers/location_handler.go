package handlers

import (
	"strconv"

	"aurora-backend/internal/infrastructure/persistence/postgres"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type LocationHandler struct {
	db   *gorm.DB
	repo *postgres.LocationRepository
}

func NewLocationHandler(db *gorm.DB) *LocationHandler {
	return &LocationHandler{
		db:   db,
		repo: postgres.NewLocationRepository(db),
	}
}

func (h *LocationHandler) ListRegions(c *fiber.Ctx) error {
	regions, err := h.repo.ListRegions(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Error al obtener regiones",
		})
	}
	return c.JSON(regions)
}

func (h *LocationHandler) ListDepartments(c *fiber.Ctx) error {
	regionIdStr := c.Query("regionId")
	if regionIdStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Se requiere regionId",
		})
	}
	regionId, err := strconv.Atoi(regionIdStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "regionId inválido",
		})
	}

	departments, err := h.repo.ListDepartmentsByRegion(c.Context(), regionId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Error al obtener departamentos",
		})
	}
	return c.JSON(departments)
}

func (h *LocationHandler) ListMunicipalities(c *fiber.Ctx) error {
	departmentIdStr := c.Query("departmentId")
	if departmentIdStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Se requiere departmentId",
		})
	}
	departmentId, err := strconv.Atoi(departmentIdStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "departmentId inválido",
		})
	}

	municipalities, err := h.repo.ListMunicipalitiesByDepartment(c.Context(), departmentId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Error al obtener municipios",
		})
	}
	return c.JSON(municipalities)
}

func (h *LocationHandler) ListGroupings(c *fiber.Ctx) error {
	municipalityIdStr := c.Query("municipalityId")
	if municipalityIdStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Se requiere municipalityId",
		})
	}
	municipalityId, err := strconv.Atoi(municipalityIdStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "municipalityId inválido",
		})
	}

	groupings, err := h.repo.ListGroupingsByMunicipality(c.Context(), municipalityId)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Error al obtener agrupaciones",
		})
	}
	return c.JSON(groupings)
}
