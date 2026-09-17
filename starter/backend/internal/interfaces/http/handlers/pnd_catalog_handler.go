package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
)

// ListCatalogPnd lista el catálogo PND con paginación y búsqueda
func (h *CatalogHandler) ListCatalogPnd(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	search := strings.TrimSpace(c.Query("q"))

	result, err := h.repo.ListPndCatalogs(c.Context(), postgres.PndListParams{
		Page:   page,
		Limit:  limit,
		Search: search,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to list PND catalog",
			"details": err.Error(),
		})
	}

	return c.JSON(dto.PaginatedPndResponse{
		Data: result.Items,
		Meta: dto.PaginationMeta{
			Total:    result.Total,
			Page:     result.Page,
			Limit:    result.Limit,
			LastPage: result.LastPage,
		},
	})
}

// ImportPnd importa el catálogo PND desde un JSON o CSV (multipart form)
func (h *CatalogHandler) ImportPnd(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "file is required"})
	}

	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "unable to open uploaded file"})
	}
	defer file.Close()

	var items []models.PNDCatalog

	filename := strings.ToLower(fileHeader.Filename)
	if strings.HasSuffix(filename, ".json") {
		bytes, err := io.ReadAll(file)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to read json file"})
		}
		if err := json.Unmarshal(bytes, &items); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": fmt.Sprintf("invalid json format: %v", err)})
		}
	} else if strings.HasSuffix(filename, ".csv") {
		reader := csv.NewReader(file)
		// Assume first row is header
		headers, err := reader.Read()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid csv format"})
		}

		headerMap := make(map[string]int)
		for i, h := range headers {
			headerMap[strings.ToLower(strings.TrimSpace(h))] = i
		}

		for {
			row, err := reader.Read()
			if err == io.EOF {
				break
			}
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "error reading csv rows"})
			}

			// A helper function to safely get string value by header name
			getVal := func(key string) string {
				if idx, ok := headerMap[key]; ok && idx < len(row) {
					return strings.TrimSpace(row[idx])
				}
				return ""
			}

			getInt := func(key string) int {
				v := getVal(key)
				if v == "" {
					return 0
				}
				i, _ := strconv.Atoi(v)
				return i
			}

			getPInt := func(key string) *int {
				v := getVal(key)
				if v == "" {
					return nil
				}
				i, err := strconv.Atoi(v)
				if err != nil {
					return nil
				}
				return &i
			}

			getPString := func(key string) *string {
				v := getVal(key)
				if v == "" {
					return nil
				}
				return &v
			}

			item := models.PNDCatalog{
				PlanID:               getPInt("planid"),
				PlanName:             getPString("planname"),
				PillarID:             getInt("pillarid"),
				ObjectiveID:          getInt("objectiveid"),
				StrategyID:           getInt("strategyid"),
				ComponentID:          getInt("componentid"),
				PillarDescription:    getVal("pillardescription"),
				ObjectiveDescription: getVal("objectivedescription"),
				StrategyDescription:  getVal("strategydescription"),
				ComponentDescription: getVal("componentdescription"),
				RowState:             getInt("rowstate"),
				UniqueIdentifier:     getPString("uniqueidentifier"),
			}
			// Let's also check snake_case equivalents just in case
			if getVal("pillarid") == "" && getVal("pillar_description") != "" {
				item.PillarDescription = getVal("pillar_description")
				item.ObjectiveDescription = getVal("objective_description")
				item.StrategyDescription = getVal("strategy_description")
				item.ComponentDescription = getVal("component_description")
				item.PillarID = getInt("pillar_id")
				item.ObjectiveID = getInt("objective_id")
				item.StrategyID = getInt("strategy_id")
				item.ComponentID = getInt("component_id")
			}

			items = append(items, item)
		}
	} else {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "only .json and .csv files are supported"})
	}

	if err := h.repo.BulkInsertPnd(c.Context(), items); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to bulk insert PND catalog",
			"details": err.Error(),
		})
	}

	return c.JSON(dto.PndImportResponse{
		Status:   "success",
		Message:  "PND catalog imported successfully",
		Inserted: len(items),
	})
}
