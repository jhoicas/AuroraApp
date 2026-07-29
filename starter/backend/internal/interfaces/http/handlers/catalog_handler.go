package handlers

import (
	"errors"
	"fmt"
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

// CreateProgram crea un programa/subprograma individual (upsert por códigos).
func (h *CatalogHandler) CreateProgram(c *fiber.Ctx) error {
	var req dto.CreateProgramRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.CodigoSector = strings.TrimSpace(req.CodigoSector)
	req.NombreSector = strings.TrimSpace(req.NombreSector)
	req.CodigoPrograma = strings.TrimSpace(req.CodigoPrograma)
	req.NombrePrograma = strings.TrimSpace(req.NombrePrograma)
	req.AmbitoAplicacion = strings.TrimSpace(req.AmbitoAplicacion)
	req.CodigoSubprograma = strings.TrimSpace(req.CodigoSubprograma)
	req.NombreSubprograma = strings.TrimSpace(req.NombreSubprograma)
	req.Observaciones = strings.TrimSpace(req.Observaciones)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	sectorID, err := h.repo.FindSectorIDByCode(c.Context(), req.CodigoSector)
	if err != nil {
		if errors.Is(err, postgres.ErrSectorNotFound) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf(
					"El sector con código %s no existe en la base de datos. Por favor, créelo primero",
					req.CodigoSector,
				),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to resolve sector",
		})
	}

	nombreSector := req.NombreSector
	if nombreSector == "" {
		nombreSector = req.CodigoSector
	}

	item := models.ProgramSubprogram{
		SectorID:          sectorID,
		CodigoSector:      req.CodigoSector,
		NombreSector:      nombreSector,
		CodigoPrograma:    req.CodigoPrograma,
		NombrePrograma:    req.NombrePrograma,
		AmbitoAplicacion:  req.AmbitoAplicacion,
		CodigoSubprograma: req.CodigoSubprograma,
		NombreSubprograma: req.NombreSubprograma,
		Observaciones:     req.Observaciones,
	}
	if _, err := h.repo.UpsertProgramSubprogramByCode(c.Context(), &item); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create program"})
	}
	return c.Status(fiber.StatusCreated).JSON(toProgramSubprogramResponse(item))
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
			if errors.Is(err, postgres.ErrSectorNotFound) {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": fmt.Sprintf(
						"El sector con código %s no existe en la base de datos. Por favor, créelo primero",
						strings.TrimSpace(row.CodigoSector),
					),
				})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "failed to resolve sector during import",
				"details": err.Error(),
			})
		}
		if sectorID == uuid.Nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf(
					"El sector con código %s no existe en la base de datos. Por favor, créelo primero",
					strings.TrimSpace(row.CodigoSector),
				),
			})
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
		Order("codigo_programa ASC").
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

func (h *CatalogHandler) ListCatalogProducts(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	search := strings.TrimSpace(c.Query("search"))
	if search == "" {
		search = strings.TrimSpace(c.Query("q"))
	}

	result, err := h.repo.ListCatalogProducts(c.Context(), postgres.CatalogProductListParams{
		Page:   page,
		Limit:  limit,
		Search: search,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to list products",
			"details": err.Error(),
		})
	}

	data := make([]dto.CatalogProductResponse, 0, len(result.Items))
	for _, item := range result.Items {
		data = append(data, toCatalogProductResponse(item))
	}

	return c.JSON(dto.PaginatedCatalogProductsResponse{
		Data: data,
		Meta: dto.PaginationMeta{
			Total:    result.Total,
			Page:     result.Page,
			Limit:    result.Limit,
			LastPage: result.LastPage,
		},
	})
}

// CreateProduct crea un producto del catálogo (upsert por codigo_producto + codigo_indicador).
func (h *CatalogHandler) CreateProduct(c *fiber.Ctx) error {
	var req dto.CreateCatalogProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Sector = strings.TrimSpace(req.Sector)
	req.NombreSector = strings.TrimSpace(req.NombreSector)
	req.CodigoPrograma = strings.TrimSpace(req.CodigoPrograma)
	req.NombrePrograma = strings.TrimSpace(req.NombrePrograma)
	req.CodigoProducto = strings.TrimSpace(req.CodigoProducto)
	req.Producto = strings.TrimSpace(req.Producto)
	req.Descripcion = strings.TrimSpace(req.Descripcion)
	req.MedidoATravesDe = strings.TrimSpace(req.MedidoATravesDe)
	req.CodigoIndicadorProducto = strings.TrimSpace(req.CodigoIndicadorProducto)
	req.IndicadorProducto = strings.TrimSpace(req.IndicadorProducto)
	req.UnidadDeMedida = strings.TrimSpace(req.UnidadDeMedida)
	req.ODS = strings.TrimSpace(req.ODS)
	req.MetaODS = strings.TrimSpace(req.MetaODS)
	req.TipologiaGeneralSUIFP = strings.TrimSpace(req.TipologiaGeneralSUIFP)
	req.EDT = strings.TrimSpace(req.EDT)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if _, err := h.repo.ProgramExistsByCode(c.Context(), req.CodigoPrograma); err != nil {
		if errors.Is(err, postgres.ErrProgramNotFound) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf(
					"El programa con código %s no existe en la base de datos. Por favor, créelo primero",
					req.CodigoPrograma,
				),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify program"})
	}

	item := models.CatalogProduct{
		Sector:                  req.Sector,
		NombreSector:            req.NombreSector,
		CodigoPrograma:          req.CodigoPrograma,
		NombrePrograma:          req.NombrePrograma,
		CodigoProducto:          req.CodigoProducto,
		Producto:                req.Producto,
		Descripcion:             req.Descripcion,
		MedidoATravesDe:         req.MedidoATravesDe,
		CodigoIndicadorProducto: req.CodigoIndicadorProducto,
		IndicadorProducto:       req.IndicadorProducto,
		UnidadDeMedida:          req.UnidadDeMedida,
		IndicadorPrincipal:      req.IndicadorPrincipal,
		EsNacional:              req.EsNacional,
		EsTerritorial:           req.EsTerritorial,
		ODS:                     req.ODS,
		MetaODS:                 req.MetaODS,
		TipologiaGeneralSUIFP:   req.TipologiaGeneralSUIFP,
		TipologiaD:              req.TipologiaD,
		TipologiaE:              req.TipologiaE,
		TipologiaAPIIP:          req.TipologiaAPIIP,
		TipologiaBPIIP:          req.TipologiaBPIIP,
		TipologiaCPIIP:          req.TipologiaCPIIP,
		TieneEDT:                req.TieneEDT,
		EDT:                     req.EDT,
	}
	if _, err := h.repo.UpsertCatalogProductByCode(c.Context(), &item); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create product"})
	}
	return c.Status(fiber.StatusCreated).JSON(toCatalogProductResponse(item))
}

// UpdateProduct actualiza un producto del catálogo por ID.
func (h *CatalogHandler) UpdateProduct(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid product id"})
	}

	var req dto.CreateCatalogProductRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Sector = strings.TrimSpace(req.Sector)
	req.NombreSector = strings.TrimSpace(req.NombreSector)
	req.CodigoPrograma = strings.TrimSpace(req.CodigoPrograma)
	req.NombrePrograma = strings.TrimSpace(req.NombrePrograma)
	req.CodigoProducto = strings.TrimSpace(req.CodigoProducto)
	req.Producto = strings.TrimSpace(req.Producto)
	req.Descripcion = strings.TrimSpace(req.Descripcion)
	req.MedidoATravesDe = strings.TrimSpace(req.MedidoATravesDe)
	req.CodigoIndicadorProducto = strings.TrimSpace(req.CodigoIndicadorProducto)
	req.IndicadorProducto = strings.TrimSpace(req.IndicadorProducto)
	req.UnidadDeMedida = strings.TrimSpace(req.UnidadDeMedida)
	req.ODS = strings.TrimSpace(req.ODS)
	req.MetaODS = strings.TrimSpace(req.MetaODS)
	req.TipologiaGeneralSUIFP = strings.TrimSpace(req.TipologiaGeneralSUIFP)
	req.EDT = strings.TrimSpace(req.EDT)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	if _, err := h.repo.ProgramExistsByCode(c.Context(), req.CodigoPrograma); err != nil {
		if errors.Is(err, postgres.ErrProgramNotFound) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf(
					"El programa con código %s no existe en la base de datos. Por favor, créelo primero",
					req.CodigoPrograma,
				),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify program"})
	}

	item := models.CatalogProduct{
		Sector:                  req.Sector,
		NombreSector:            req.NombreSector,
		CodigoPrograma:          req.CodigoPrograma,
		NombrePrograma:          req.NombrePrograma,
		CodigoProducto:          req.CodigoProducto,
		Producto:                req.Producto,
		Descripcion:             req.Descripcion,
		MedidoATravesDe:         req.MedidoATravesDe,
		CodigoIndicadorProducto: req.CodigoIndicadorProducto,
		IndicadorProducto:       req.IndicadorProducto,
		UnidadDeMedida:          req.UnidadDeMedida,
		IndicadorPrincipal:      req.IndicadorPrincipal,
		EsNacional:              req.EsNacional,
		EsTerritorial:           req.EsTerritorial,
		ODS:                     req.ODS,
		MetaODS:                 req.MetaODS,
		TipologiaGeneralSUIFP:   req.TipologiaGeneralSUIFP,
		TipologiaD:              req.TipologiaD,
		TipologiaE:              req.TipologiaE,
		TipologiaAPIIP:          req.TipologiaAPIIP,
		TipologiaBPIIP:          req.TipologiaBPIIP,
		TipologiaCPIIP:          req.TipologiaCPIIP,
		TieneEDT:                req.TieneEDT,
		EDT:                     req.EDT,
	}
	if err := h.repo.UpdateCatalogProductByID(c.Context(), id, &item); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "product not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update product"})
	}
	return c.JSON(toCatalogProductResponse(item))
}

// DeleteProduct elimina un producto del catálogo por ID.
func (h *CatalogHandler) DeleteProduct(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid product id"})
	}
	if err := h.repo.DeleteCatalogProductByID(c.Context(), id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "product not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete product"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ImportProducts importa productos desde XLSX o CSV (multipart "file").
func (h *CatalogHandler) ImportProducts(c *fiber.Ctx) error {
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
	var parsed *postgres.ProductParseResult
	switch ext {
	case ".xlsx", ".xls":
		parsed, err = postgres.ParseProductsFromXLSX(src)
	case ".csv":
		parsed, err = postgres.ParseProductsFromCSV(src)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "unsupported file type; use .xlsx or .csv",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	programCodes, err := h.repo.LoadProgramCodeSet(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to load programs for import validation",
			"details": err.Error(),
		})
	}

	skipped := 0
	importErrors := make([]dto.ImportRowError, 0, len(parsed.Errors))
	for _, pe := range parsed.Errors {
		skipped++
		importErrors = append(importErrors, dto.ImportRowError{
			Row:            pe.Row,
			CodigoProducto: pe.CodigoProducto,
			Message:        pe.Message,
		})
	}

	toUpsert := make([]models.CatalogProduct, 0, len(parsed.Rows))
	for _, row := range parsed.Rows {
		rowNum := row.SourceRow
		if rowNum <= 0 {
			rowNum = 0
		}
		codigoProducto := strings.TrimSpace(row.CodigoProducto)
		nombreProducto := strings.TrimSpace(row.Producto)
		if codigoProducto == "" || nombreProducto == "" {
			skipped++
			var msg string
			switch {
			case codigoProducto == "" && nombreProducto == "":
				msg = "Fila vacía: se requieren código y nombre de producto"
			case codigoProducto == "":
				msg = "Falta código de producto"
			default:
				msg = "Falta nombre de producto"
			}
			importErrors = append(importErrors, dto.ImportRowError{
				Row:            rowNum,
				CodigoProducto: codigoProducto,
				Message:        msg,
			})
			continue
		}

		codigoPrograma := strings.TrimSpace(row.CodigoPrograma)
		nombrePrograma := strings.TrimSpace(row.NombrePrograma)
		if codigoPrograma == "" {
			skipped++
			importErrors = append(importErrors, dto.ImportRowError{
				Row:            rowNum,
				CodigoProducto: codigoProducto,
				Message:        "Falta código de programa (columna índice 2: Código del Programa)",
			})
			continue
		}
		if len(codigoPrograma) > 15 {
			skipped++
			importErrors = append(importErrors, dto.ImportRowError{
				Row:            rowNum,
				CodigoProducto: codigoProducto,
				Message:        "Estructura de columnas inválida o código mal formado",
			})
			continue
		}
		if len(codigoProducto) > 50 {
			skipped++
			importErrors = append(importErrors, dto.ImportRowError{
				Row:            rowNum,
				CodigoProducto: codigoProducto[:50] + "…",
				Message:        "Estructura de columnas inválida o código mal formado",
			})
			continue
		}
		if _, ok := programCodes[codigoPrograma]; !ok {
			skipped++
			importErrors = append(importErrors, dto.ImportRowError{
				Row:            rowNum,
				CodigoProducto: codigoProducto,
				Message: fmt.Sprintf(
					"El programa con código «%s» no existe en la base de datos. Por favor, créelo primero (nombre de programa leído: «%s»)",
					codigoPrograma,
					nombrePrograma,
				),
			})
			continue
		}

		toUpsert = append(toUpsert, models.CatalogProduct{
			Sector:                  strings.TrimSpace(row.Sector),
			NombreSector:            strings.TrimSpace(row.NombreSector),
			CodigoPrograma:          codigoPrograma,
			NombrePrograma:          nombrePrograma,
			CodigoProducto:          codigoProducto,
			Producto:                nombreProducto,
			Descripcion:             strings.TrimSpace(row.Descripcion),
			MedidoATravesDe:         strings.TrimSpace(row.MedidoATravesDe),
			CodigoIndicadorProducto: strings.TrimSpace(row.CodigoIndicadorProducto),
			IndicadorProducto:       strings.TrimSpace(row.IndicadorProducto),
			UnidadDeMedida:          strings.TrimSpace(row.UnidadDeMedida),
			IndicadorPrincipal:      row.IndicadorPrincipal,
			EsNacional:              row.EsNacional,
			EsTerritorial:           row.EsTerritorial,
			ODS:                     strings.TrimSpace(row.ODS),
			MetaODS:                 strings.TrimSpace(row.MetaODS),
			TipologiaGeneralSUIFP:   strings.TrimSpace(row.TipologiaGeneralSUIFP),
			TipologiaD:              row.TipologiaD,
			TipologiaE:              row.TipologiaE,
			TipologiaAPIIP:          row.TipologiaAPIIP,
			TipologiaBPIIP:          row.TipologiaBPIIP,
			TipologiaCPIIP:          row.TipologiaCPIIP,
			TieneEDT:                row.TieneEDT,
			EDT:                     strings.TrimSpace(row.EDT),
		})
	}

	result, err := h.repo.BulkUpsertCatalogProducts(c.Context(), toUpsert)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to import products",
			"details": err.Error(),
		})
	}

	for _, be := range result.BatchErrors {
		skipped++
		importErrors = append(importErrors, dto.ImportRowError{
			Message: be,
		})
	}

	msg := "Importación de productos procesada"
	if len(importErrors) > 0 {
		msg = fmt.Sprintf(
			"Importación procesada con %d advertencias/errores de fila (válidas para upsert: %d)",
			len(importErrors),
			len(toUpsert),
		)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ProductImportResponse{
		Status:          "success",
		Message:         msg,
		Inserted:        result.Inserted,
		Updated:         result.Updated,
		Skipped:         skipped,
		TotalRowsParsed: parsed.TotalRows,
		Errors:          importErrors,
	})
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
			"(producto ILIKE ? ESCAPE '\\' OR codigo_producto ILIKE ? ESCAPE '\\')",
			pattern, pattern,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count products"})
	}

	products := make([]models.Product, 0)
	if err := query.Order("codigo_producto ASC").Limit(pageSize).Offset(offset).Find(&products).Error; err != nil {
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

func toCatalogProductResponse(p models.CatalogProduct) dto.CatalogProductResponse {
	var tenantID *string
	if p.TenantID != nil {
		s := p.TenantID.String()
		tenantID = &s
	}
	return dto.CatalogProductResponse{
		ID:                      p.ID.String(),
		TenantID:                tenantID,
		Sector:                  p.Sector,
		NombreSector:            p.NombreSector,
		CodigoPrograma:          p.CodigoPrograma,
		NombrePrograma:          p.NombrePrograma,
		CodigoProducto:          p.CodigoProducto,
		Producto:                p.Producto,
		Descripcion:             p.Descripcion,
		MedidoATravesDe:         p.MedidoATravesDe,
		CodigoIndicadorProducto: p.CodigoIndicadorProducto,
		IndicadorProducto:       p.IndicadorProducto,
		UnidadDeMedida:          p.UnidadDeMedida,
		IndicadorPrincipal:      p.IndicadorPrincipal,
		EsNacional:              p.EsNacional,
		EsTerritorial:           p.EsTerritorial,
		ODS:                     p.ODS,
		MetaODS:                 p.MetaODS,
		TipologiaGeneralSUIFP:   p.TipologiaGeneralSUIFP,
		TipologiaD:              p.TipologiaD,
		TipologiaE:              p.TipologiaE,
		TipologiaAPIIP:          p.TipologiaAPIIP,
		TipologiaBPIIP:          p.TipologiaBPIIP,
		TipologiaCPIIP:          p.TipologiaCPIIP,
		TieneEDT:                p.TieneEDT,
		EDT:                     p.EDT,
		CreatedAt:               p.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func (h *CatalogHandler) ListCatalogEdt(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	search := strings.TrimSpace(c.Query("search"))
	if search == "" {
		search = strings.TrimSpace(c.Query("q"))
	}

	result, err := h.repo.ListCatalogEdt(c.Context(), postgres.CatalogEdtListParams{
		Page:   page,
		Limit:  limit,
		Search: search,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to list edt",
			"details": err.Error(),
		})
	}

	data := make([]dto.CatalogEdtResponse, 0, len(result.Items))
	for _, item := range result.Items {
		data = append(data, toCatalogEdtResponse(item))
	}
	return c.JSON(dto.PaginatedCatalogEdtResponse{
		Data: data,
		Meta: dto.PaginationMeta{
			Total:    result.Total,
			Page:     result.Page,
			Limit:    result.Limit,
			LastPage: result.LastPage,
		},
	})
}

// ImportEdt importa el catálogo EDT desde XLSX o CSV (multipart "file").
func (h *CatalogHandler) ImportEdt(c *fiber.Ctx) error {
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
	var parsed *postgres.EdtParseResult
	switch ext {
	case ".xlsx", ".xls":
		parsed, err = postgres.ParseEdtFromXLSX(src)
	case ".csv":
		parsed, err = postgres.ParseEdtFromCSV(src)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "unsupported file type; use .xlsx or .csv",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	skipped := 0
	importErrors := make([]dto.ImportRowError, 0, len(parsed.Errors))
	for _, pe := range parsed.Errors {
		skipped++
		importErrors = append(importErrors, dto.ImportRowError{
			Row:            pe.Row,
			CodigoProducto: pe.CodigoProducto,
			Message:        pe.Message,
		})
	}

	toUpsert := make([]models.CatalogEdt, 0, len(parsed.Rows))
	for _, row := range parsed.Rows {
		toUpsert = append(toUpsert, models.CatalogEdt{
			CodigoProductoEstandarizado: strings.TrimSpace(row.CodigoProductoEstandarizado),
			NombreProducto:              strings.TrimSpace(row.NombreProducto),
			CodigoEntregableL1:          strings.TrimSpace(row.CodigoEntregableL1),
			NombreEntregableL1:          strings.TrimSpace(row.NombreEntregableL1),
			CodigoEntregableL2:          strings.TrimSpace(row.CodigoEntregableL2),
			NombreEntregableL2:          strings.TrimSpace(row.NombreEntregableL2),
			CodigoEntregableL3:          strings.TrimSpace(row.CodigoEntregableL3),
			NombreEntregableL3:          strings.TrimSpace(row.NombreEntregableL3),
			CodigoActividad:             strings.TrimSpace(row.CodigoActividad),
			Actividad:                   strings.TrimSpace(row.Actividad),
			UnidadDeMedida:              strings.TrimSpace(row.UnidadDeMedida),
		})
	}

	result, err := h.repo.BulkUpsertCatalogEdt(c.Context(), toUpsert)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to import edt",
			"details": err.Error(),
		})
	}
	for _, be := range result.BatchErrors {
		skipped++
		importErrors = append(importErrors, dto.ImportRowError{Message: be})
	}

	msg := "Importación de catálogo EDT procesada"
	if len(importErrors) > 0 {
		msg = fmt.Sprintf(
			"Importación EDT procesada con %d advertencias/errores de fila (válidas para upsert: %d)",
			len(importErrors),
			len(toUpsert),
		)
	}
	return c.Status(fiber.StatusOK).JSON(dto.EdtImportResponse{
		Status:          "success",
		Message:         msg,
		Inserted:        result.Inserted,
		Updated:         result.Updated,
		Skipped:         skipped,
		TotalRowsParsed: parsed.TotalRows,
		Errors:          importErrors,
	})
}

func toCatalogEdtResponse(e models.CatalogEdt) dto.CatalogEdtResponse {
	var tenantID *string
	if e.TenantID != nil {
		s := e.TenantID.String()
		tenantID = &s
	}
	return dto.CatalogEdtResponse{
		ID:                          e.ID.String(),
		TenantID:                    tenantID,
		CodigoProductoEstandarizado: e.CodigoProductoEstandarizado,
		NombreProducto:              e.NombreProducto,
		CodigoEntregableL1:          e.CodigoEntregableL1,
		NombreEntregableL1:          e.NombreEntregableL1,
		CodigoEntregableL2:          e.CodigoEntregableL2,
		NombreEntregableL2:          e.NombreEntregableL2,
		CodigoEntregableL3:          e.CodigoEntregableL3,
		NombreEntregableL3:          e.NombreEntregableL3,
		CodigoActividad:             e.CodigoActividad,
		Actividad:                   e.Actividad,
		UnidadDeMedida:              e.UnidadDeMedida,
		CreatedAt:                   e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

// ListCatalogDeliverables GET /api/v1/catalog/deliverables
func (h *CatalogHandler) ListCatalogDeliverables(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	search := strings.TrimSpace(c.Query("search"))

	result, err := h.repo.ListCatalogDeliverables(c.Context(), postgres.CatalogDeliverableListParams{
		Page:   page,
		Limit:  limit,
		Search: search,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	data := make([]dto.CatalogDeliverableResponse, 0, len(result.Items))
	for _, item := range result.Items {
		data = append(data, toCatalogDeliverableResponse(item))
	}
	return c.JSON(dto.PaginatedCatalogDeliverableResponse{
		Data: data,
		Meta: dto.PaginationMeta{
			Total:    result.Total,
			Page:     result.Page,
			Limit:    result.Limit,
			LastPage: result.LastPage,
		},
	})
}

// ImportDeliverables importa el catálogo de entregables desde XLSX o CSV.
func (h *CatalogHandler) ImportDeliverables(c *fiber.Ctx) error {
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
	var parsed *postgres.DeliverableParseResult
	switch ext {
	case ".xlsx", ".xls":
		parsed, err = postgres.ParseDeliverablesFromXLSX(src)
	case ".csv":
		parsed, err = postgres.ParseDeliverablesFromCSV(src)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "unsupported file type; use .xlsx or .csv",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	skipped := 0
	importErrors := make([]dto.ImportRowError, 0, len(parsed.Errors))
	for _, pe := range parsed.Errors {
		skipped++
		importErrors = append(importErrors, dto.ImportRowError{
			Row:            pe.Row,
			CodigoProducto: pe.CodigoEntregable,
			Message:        pe.Message,
		})
	}

	toUpsert := make([]models.CatalogDeliverable, 0, len(parsed.Rows))
	for _, row := range parsed.Rows {
		toUpsert = append(toUpsert, models.CatalogDeliverable{
			CodigoEntregable:     strings.TrimSpace(row.CodigoEntregable),
			ListadoDeEntregables: strings.TrimSpace(row.ListadoDeEntregables),
		})
	}

	result, err := h.repo.BulkUpsertCatalogDeliverables(c.Context(), toUpsert)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to import deliverables",
			"details": err.Error(),
		})
	}
	for _, be := range result.BatchErrors {
		skipped++
		importErrors = append(importErrors, dto.ImportRowError{Message: be})
	}

	msg := "Importación de catálogo de entregables procesada"
	if len(importErrors) > 0 {
		msg = fmt.Sprintf(
			"%s (%d advertencias/errores de fila)",
			msg, len(importErrors),
		)
	}

	return c.Status(fiber.StatusOK).JSON(dto.DeliverableImportResponse{
		Status:          "success",
		Message:         msg,
		Inserted:        result.Inserted,
		Updated:         result.Updated,
		Skipped:         skipped,
		TotalRowsParsed: parsed.TotalRows,
		Errors:          importErrors,
	})
}

func toCatalogDeliverableResponse(e models.CatalogDeliverable) dto.CatalogDeliverableResponse {
	var tenantID *string
	if e.TenantID != nil {
		s := e.TenantID.String()
		tenantID = &s
	}
	return dto.CatalogDeliverableResponse{
		ID:                   e.ID.String(),
		TenantID:             tenantID,
		CodigoEntregable:     e.CodigoEntregable,
		ListadoDeEntregables: e.ListadoDeEntregables,
		CreatedAt:            e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

// ListCatalogActivities GET /api/v1/catalog/activities
func (h *CatalogHandler) ListCatalogActivities(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	search := strings.TrimSpace(c.Query("search"))

	result, err := h.repo.ListCatalogActivities(c.Context(), postgres.CatalogActivityListParams{
		Page:   page,
		Limit:  limit,
		Search: search,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	data := make([]dto.CatalogActivityResponse, 0, len(result.Items))
	for _, item := range result.Items {
		data = append(data, toCatalogActivityResponse(item))
	}
	return c.JSON(dto.PaginatedCatalogActivityResponse{
		Data: data,
		Meta: dto.PaginationMeta{
			Total:    result.Total,
			Page:     result.Page,
			Limit:    result.Limit,
			LastPage: result.LastPage,
		},
	})
}

// ImportActivities importa el catálogo de actividades desde XLSX o CSV.
func (h *CatalogHandler) ImportActivities(c *fiber.Ctx) error {
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
	var parsed *postgres.ActivityParseResult
	switch ext {
	case ".xlsx", ".xls":
		parsed, err = postgres.ParseActivitiesFromXLSX(src)
	case ".csv":
		parsed, err = postgres.ParseActivitiesFromCSV(src)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "unsupported file type; use .xlsx or .csv",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	skipped := 0
	importErrors := make([]dto.ImportRowError, 0, len(parsed.Errors))
	for _, pe := range parsed.Errors {
		skipped++
		importErrors = append(importErrors, dto.ImportRowError{
			Row:            pe.Row,
			CodigoProducto: pe.CodigoActividad,
			Message:        pe.Message,
		})
	}

	toUpsert := make([]models.CatalogActivity, 0, len(parsed.Rows))
	for _, row := range parsed.Rows {
		toUpsert = append(toUpsert, models.CatalogActivity{
			CodigoActividad:      strings.TrimSpace(row.CodigoActividad),
			ListadoDeActividades: strings.TrimSpace(row.ListadoDeActividades),
			UnidadDeMedida:       strings.TrimSpace(row.UnidadDeMedida),
		})
	}

	result, err := h.repo.BulkUpsertCatalogActivities(c.Context(), toUpsert)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to import activities",
			"details": err.Error(),
		})
	}
	for _, be := range result.BatchErrors {
		skipped++
		importErrors = append(importErrors, dto.ImportRowError{Message: be})
	}

	msg := "Importación de catálogo de actividades procesada"
	if len(importErrors) > 0 {
		msg = fmt.Sprintf(
			"%s (%d advertencias/errores de fila)",
			msg, len(importErrors),
		)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ActivityImportResponse{
		Status:          "success",
		Message:         msg,
		Inserted:        result.Inserted,
		Updated:         result.Updated,
		Skipped:         skipped,
		TotalRowsParsed: parsed.TotalRows,
		Errors:          importErrors,
	})
}

func toCatalogActivityResponse(e models.CatalogActivity) dto.CatalogActivityResponse {
	var tenantID *string
	if e.TenantID != nil {
		s := e.TenantID.String()
		tenantID = &s
	}
	return dto.CatalogActivityResponse{
		ID:                   e.ID.String(),
		TenantID:             tenantID,
		CodigoActividad:      e.CodigoActividad,
		ListadoDeActividades: e.ListadoDeActividades,
		UnidadDeMedida:       e.UnidadDeMedida,
		CreatedAt:            e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

// ListCatalogOds GET /api/v1/catalog/ods
func (h *CatalogHandler) ListCatalogOds(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	search := strings.TrimSpace(c.Query("search"))

	result, err := h.repo.ListCatalogOds(c.Context(), postgres.CatalogOdsListParams{
		Page:   page,
		Limit:  limit,
		Search: search,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	data := make([]dto.CatalogOdsResponse, 0, len(result.Items))
	for _, item := range result.Items {
		data = append(data, toCatalogOdsResponse(item))
	}
	return c.JSON(dto.PaginatedCatalogOdsResponse{
		Data: data,
		Meta: dto.PaginationMeta{
			Total:    result.Total,
			Page:     result.Page,
			Limit:    result.Limit,
			LastPage: result.LastPage,
		},
	})
}

// ImportOds importa el catálogo ODS desde XLSX o CSV.
func (h *CatalogHandler) ImportOds(c *fiber.Ctx) error {
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
	var parsed *postgres.OdsParseResult
	switch ext {
	case ".xlsx", ".xls":
		parsed, err = postgres.ParseOdsFromXLSX(src)
	case ".csv":
		parsed, err = postgres.ParseOdsFromCSV(src)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "unsupported file type; use .xlsx or .csv",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	skipped := 0
	importErrors := make([]dto.ImportRowError, 0, len(parsed.Errors))
	for _, pe := range parsed.Errors {
		skipped++
		importErrors = append(importErrors, dto.ImportRowError{
			Row:            pe.Row,
			CodigoProducto: pe.CodObjetivoOds,
			Message:        pe.Message,
		})
	}

	toUpsert := make([]models.CatalogOds, 0, len(parsed.Rows))
	for _, row := range parsed.Rows {
		toUpsert = append(toUpsert, models.CatalogOds{
			CodObjetivoOds:         strings.TrimSpace(row.CodObjetivoOds),
			DescripcionObjetivoOds: strings.TrimSpace(row.DescripcionObjetivoOds),
			CodigoMetaOds:          strings.TrimSpace(row.CodigoMetaOds),
			DescripcionMetaOds:     strings.TrimSpace(row.DescripcionMetaOds),
		})
	}

	result, err := h.repo.BulkUpsertCatalogOds(c.Context(), toUpsert)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to import ods",
			"details": err.Error(),
		})
	}
	for _, be := range result.BatchErrors {
		skipped++
		importErrors = append(importErrors, dto.ImportRowError{Message: be})
	}

	msg := "Importación de catálogo ODS procesada"
	if len(importErrors) > 0 {
		msg = fmt.Sprintf(
			"%s (%d advertencias/errores de fila)",
			msg, len(importErrors),
		)
	}

	return c.Status(fiber.StatusOK).JSON(dto.OdsImportResponse{
		Status:          "success",
		Message:         msg,
		Inserted:        result.Inserted,
		Updated:         result.Updated,
		Skipped:         skipped,
		TotalRowsParsed: parsed.TotalRows,
		Errors:          importErrors,
	})
}

func toCatalogOdsResponse(e models.CatalogOds) dto.CatalogOdsResponse {
	var tenantID *string
	if e.TenantID != nil {
		s := e.TenantID.String()
		tenantID = &s
	}
	return dto.CatalogOdsResponse{
		ID:                     e.ID.String(),
		TenantID:               tenantID,
		CodObjetivoOds:         e.CodObjetivoOds,
		DescripcionObjetivoOds: e.DescripcionObjetivoOds,
		CodigoMetaOds:          e.CodigoMetaOds,
		DescripcionMetaOds:     e.DescripcionMetaOds,
		CreatedAt:              e.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

func escapeILIKE(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}
