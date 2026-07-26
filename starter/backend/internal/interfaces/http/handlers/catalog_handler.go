package handlers

import (
	"math"
	"path/filepath"
	"strconv"
	"strings"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CatalogHandler struct {
	db   *gorm.DB
	repo *postgres.CatalogRepository
}

func NewCatalogHandler(db *gorm.DB) *CatalogHandler {
	return &CatalogHandler{
		db:   db,
		repo: postgres.NewCatalogRepository(db),
	}
}

func (h *CatalogHandler) ListSectors(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	// Compatibilidad con clientes que envían page_size
	if limit == 10 {
		if ps, err := strconv.Atoi(c.Query("page_size", "")); err == nil && ps > 0 {
			limit = ps
		}
	}
	search := strings.TrimSpace(c.Query("search"))
	if search == "" {
		search = strings.TrimSpace(c.Query("q"))
	}

	result, err := h.repo.ListSectors(c.Context(), postgres.SectorListParams{
		Page:   page,
		Limit:  limit,
		Search: search,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to list sectors",
			"details": err.Error(),
		})
	}

	data := make([]dto.SectorResponse, 0, len(result.Items))
	for _, s := range result.Items {
		data = append(data, toSectorResponse(s))
	}

	return c.JSON(dto.PaginatedSectorsResponse{
		Data: data,
		Meta: dto.PaginationMeta{
			Total:    result.Total,
			Page:     result.Page,
			Limit:    result.Limit,
			LastPage: result.LastPage,
		},
	})
}

// CreateSector crea un sector individual (upsert por código).
func (h *CatalogHandler) CreateSector(c *fiber.Ctx) error {
	var req dto.CreateSectorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Code = strings.TrimSpace(req.Code)
	req.Name = strings.TrimSpace(req.Name)
	req.Application = strings.TrimSpace(req.Application)
	req.Observations = strings.TrimSpace(req.Observations)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	sector := models.Sector{
		Code:         req.Code,
		Name:         req.Name,
		Application:  req.Application,
		Observations: req.Observations,
	}
	_, err := h.repo.UpsertSectorByCode(c.Context(), &sector)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create sector"})
	}
	return c.Status(fiber.StatusCreated).JSON(toSectorResponse(sector))
}

// ImportSectors importa sectores desde XLSX o CSV (multipart field "file").
func (h *CatalogHandler) ImportSectors(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "file is required (multipart field: file)"})
	}

	src, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "cannot open uploaded file"})
	}
	defer src.Close()

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	var rows []postgres.SectorImportRow
	switch ext {
	case ".xlsx", ".xls":
		rows, err = postgres.ParseSectorsFromXLSX(src)
	case ".csv":
		rows, err = postgres.ParseSectorsFromCSV(src)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "unsupported file type; use .xlsx or .csv",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	inserted, updated, skipped := 0, 0, 0
	for _, row := range rows {
		sector := row.ToModel()
		if sector.Code == "" || sector.Name == "" {
			skipped++
			continue
		}
		created, err := h.repo.UpsertSectorByCode(c.Context(), &sector)
		if err != nil {
			skipped++
			continue
		}
		if created {
			inserted++
		} else {
			updated++
		}
	}

	return c.Status(fiber.StatusOK).JSON(dto.SectorImportResponse{
		Status:          "success",
		Message:         "Importación de sectores procesada",
		Inserted:        inserted,
		Updated:         updated,
		Skipped:         skipped,
		TotalRowsParsed: len(rows),
	})
}

func (h *CatalogHandler) ListPrograms(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	search := strings.TrimSpace(c.Query("search"))
	if search == "" {
		search = strings.TrimSpace(c.Query("q"))
	}

	result, err := h.repo.ListProgramsSubprograms(c.Context(), postgres.ProgramListParams{
		Page:   page,
		Limit:  limit,
		Search: search,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to list programs",
			"details": err.Error(),
		})
	}

	data := make([]dto.ProgramSubprogramResponse, 0, len(result.Items))
	for _, item := range result.Items {
		data = append(data, toProgramSubprogramResponse(item))
	}

	return c.JSON(dto.PaginatedProgramsResponse{
		Data: data,
		Meta: dto.PaginationMeta{
			Total:    result.Total,
			Page:     result.Page,
			Limit:    result.Limit,
			LastPage: result.LastPage,
		},
	})
}

// ImportPrograms importa programas/subprogramas desde XLSX o CSV (multipart "file").
func (h *CatalogHandler) ImportPrograms(c *fiber.Ctx) error {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "file is required (multipart field: file)"})
	}

	src, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "cannot open uploaded file"})
	}
	defer src.Close()

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	var rows []postgres.ProgramImportRow
	switch ext {
	case ".xlsx", ".xls":
		rows, err = postgres.ParseProgramsFromXLSX(src)
	case ".csv":
		rows, err = postgres.ParseProgramsFromCSV(src)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "unsupported file type; use .xlsx or .csv",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	inserted, updated, skipped := 0, 0, 0
	for _, row := range rows {
		if row.CodigoSector == "" || row.CodigoPrograma == "" || row.CodigoSubprograma == "" {
			skipped++
			continue
		}
		if row.NombrePrograma == "" || row.NombreSubprograma == "" {
			skipped++
			continue
		}

		sectorID, err := h.repo.FindSectorIDByCode(c.Context(), row.CodigoSector)
		if err != nil {
			skipped++
			continue
		}

		item := models.ProgramSubprogram{
			SectorID:          sectorID,
			CodigoSector:      strings.TrimSpace(row.CodigoSector),
			NombreSector:      strings.TrimSpace(row.NombreSector),
			CodigoPrograma:    strings.TrimSpace(row.CodigoPrograma),
			NombrePrograma:    strings.TrimSpace(row.NombrePrograma),
			AmbitoAplicacion:  strings.TrimSpace(row.AmbitoAplicacion),
			CodigoSubprograma: strings.TrimSpace(row.CodigoSubprograma),
			NombreSubprograma: strings.TrimSpace(row.NombreSubprograma),
			Observaciones:     strings.TrimSpace(row.Observaciones),
		}
		if item.NombreSector == "" {
			item.NombreSector = row.CodigoSector
		}

		created, err := h.repo.UpsertProgramSubprogramByCode(c.Context(), &item)
		if err != nil {
			skipped++
			continue
		}
		if created {
			inserted++
		} else {
			updated++
		}
	}

	return c.Status(fiber.StatusOK).JSON(dto.ProgramImportResponse{
		Status:          "success",
		Message:         "Importación de programas/subprogramas procesada",
		Inserted:        inserted,
		Updated:         updated,
		Skipped:         skipped,
		TotalRowsParsed: len(rows),
	})
}

func (h *CatalogHandler) ListProgramsBySector(c *fiber.Ctx) error {
	sectorID, err := uuid.Parse(c.Params("sectorId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid sector id"})
	}

	var sectorCount int64
	if err := h.db.WithContext(c.Context()).
		Model(&models.Sector{}).
		Where("id = ?", sectorID).
		Count(&sectorCount).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify sector"})
	}
	if sectorCount == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "sector not found"})
	}

	var programs []models.Program
	if err := h.db.WithContext(c.Context()).
		Where("sector_id = ?", sectorID).
		Order("code ASC").
		Find(&programs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list programs"})
	}

	data := make([]dto.ProgramResponse, 0, len(programs))
	for _, p := range programs {
		data = append(data, dto.ProgramResponse{
			ID:       p.ID.String(),
			SectorID: p.SectorID.String(),
			Code:     p.Code,
			Name:     p.Name,
		})
	}

	return c.JSON(data)
}

func (h *CatalogHandler) SearchProducts(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))

	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	query := h.db.WithContext(c.Context()).Model(&models.Product{})
	if q != "" {
		pattern := "%" + escapeILIKE(q) + "%"
		query = query.Where(
			"(name ILIKE ? ESCAPE '\\' OR code ILIKE ? ESCAPE '\\' OR code_bpin ILIKE ? ESCAPE '\\')",
			pattern, pattern, pattern,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count products"})
	}

	products := make([]models.Product, 0)
	if err := query.Order("code ASC").Limit(pageSize).Offset(offset).Find(&products).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to search products"})
	}

	data := make([]dto.ProductResponse, 0, len(products))
	for _, p := range products {
		data = append(data, dto.ProductResponse{
			ID:        p.ID.String(),
			ProgramID: p.ProgramID.String(),
			Code:      p.Code,
			CodeBPIN:  p.CodeBPIN,
			Name:      p.Name,
		})
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))
	if totalPages == 0 {
		totalPages = 1
	}

	return c.JSON(dto.PaginatedProductsResponse{
		Data:       data,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
		Query:      q,
	})
}

func toSectorResponse(s models.Sector) dto.SectorResponse {
	return dto.SectorResponse{
		ID:           s.ID.String(),
		Code:         s.Code,
		Name:         s.Name,
		Application:  s.Application,
		Observations: s.Observations,
	}
}

func toProgramSubprogramResponse(p models.ProgramSubprogram) dto.ProgramSubprogramResponse {
	var tenantID *string
	if p.TenantID != nil {
		s := p.TenantID.String()
		tenantID = &s
	}
	return dto.ProgramSubprogramResponse{
		ID:                p.ID.String(),
		TenantID:          tenantID,
		SectorID:          p.SectorID.String(),
		CodigoSector:      p.CodigoSector,
		NombreSector:      p.NombreSector,
		CodigoPrograma:    p.CodigoPrograma,
		NombrePrograma:    p.NombrePrograma,
		AmbitoAplicacion:  p.AmbitoAplicacion,
		CodigoSubprograma: p.CodigoSubprograma,
		NombreSubprograma: p.NombreSubprograma,
		Observaciones:     p.Observaciones,
		CreatedAt:         p.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func escapeILIKE(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}
