package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"strconv"
	"strings"
	"time"

	"gorm.io/datatypes"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"github.com/go-playground/validator/v10"
)

type ProjectHandler struct {
	db *gorm.DB
}

func NewProjectHandler(db *gorm.DB) *ProjectHandler {
	return &ProjectHandler{db: db}
}

func (h *ProjectHandler) Create(c *fiber.Ctx) error {
	userID, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	var req dto.CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	req.Sector = strings.TrimSpace(req.Sector)
	if req.CodeBPIN != nil {
		bpin := strings.TrimSpace(*req.CodeBPIN)
		if bpin == "" {
			req.CodeBPIN = nil
		} else {
			req.CodeBPIN = &bpin
		}
	}
	if req.ProgramCode != nil {
		code := strings.TrimSpace(*req.ProgramCode)
		if code == "" {
			req.ProgramCode = nil
		} else {
			req.ProgramCode = &code
		}
	}
	if req.ProductCode != nil {
		code := strings.TrimSpace(*req.ProductCode)
		if code == "" {
			req.ProductCode = nil
		} else {
			req.ProductCode = &code
		}
	}

	if err := dto.Validate(&req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			var errMsg string
			for _, fieldErr := range validationErrors {
				switch fieldErr.Field() {
				case "Objeto":
					if fieldErr.Tag() == "min" {
						errMsg = "El objeto del proyecto debe contener al menos 10 caracteres."
					}
				case "ProcesoID":
					if fieldErr.Tag() == "required" {
						errMsg = "Por favor selecciona un Proceso MGA válido."
					}
				case "Localizaciones":
					if fieldErr.Tag() == "required" || fieldErr.Tag() == "min" {
						errMsg = "Debes agregar al menos una localización."
					}
				}
				if errMsg != "" {
					break
				}
			}
			if errMsg == "" {
				errMsg = "Por favor completa todos los campos requeridos correctamente."
			}
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": errMsg})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var sectorID *uuid.UUID
	if req.SectorID != nil {
		sid := strings.TrimSpace(*req.SectorID)
		if sid != "" {
			parsed, parseErr := uuid.Parse(sid)
			if parseErr != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid sector_id"})
			}
			sectorID = &parsed
		}
	}

	now := time.Now().UTC()
	fase := strings.TrimSpace(req.FaseMaduracion)
	if fase == "" {
		fase = "PERFIL"
	}

	project := models.Project{
		ID:             uuid.New(),
		TenantID:       tenantID,
		CreatorID:      userID,
		Name:           req.Name,
		Description:    req.Description,
		CodeBPIN:       req.CodeBPIN,
		Sector:         req.Sector,
		SectorID:       sectorID,
		ProgramCode:    req.ProgramCode,
		ProductCode:    req.ProductCode,
		FaseMaduracion: fase,
		Status:         constants.ProjectStatusInFormulation,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	mgaMap := make(map[string]interface{})
	if req.MgaFormulationData != nil {
		mgaMap = *req.MgaFormulationData
	}
	if _, ok := mgaMap["localizaciones"]; !ok && len(req.Localizaciones) > 0 {
		locItems := make([]map[string]interface{}, 0, len(req.Localizaciones))
		for _, loc := range req.Localizaciones {
			regID := loc.RegionID
			if regID == nil {
				regID = loc.RegionIDCamel
			}
			depID := loc.DepartamentoID
			if depID == nil {
				depID = loc.DepartamentoIDCamel
			}
			munID := loc.MunicipioID
			if munID == nil {
				munID = loc.MunicipioIDCamel
			}
			tipoAgrupID := loc.TipoAgrupacionID
			if tipoAgrupID == nil {
				tipoAgrupID = loc.TipoAgrupacionIDCamel
			}
			agrupID := loc.AgrupacionID
			if agrupID == nil {
				agrupID = loc.AgrupacionIDCamel
			}
			item := map[string]interface{}{
				"region_id":       regID,
				"departamento_id": depID,
				"municipio_id":    munID,
			}
			if tipoAgrupID != nil {
				item["tipo_agrupacion_id"] = tipoAgrupID
			}
			if agrupID != nil {
				item["agrupacion_id"] = agrupID
			}
			locItems = append(locItems, item)
		}
		mgaMap["localizaciones"] = locItems
	}
	if _, ok := mgaMap["tipologia"]; !ok && req.Tipologia != "" {
		mgaMap["tipologia"] = req.Tipologia
	}
	if _, ok := mgaMap["tipo_inversion"]; !ok && req.TipoInversion != "" {
		mgaMap["tipo_inversion"] = req.TipoInversion
	}
	if _, ok := mgaMap["proceso_id"]; !ok && req.ProcesoID != 0 {
		mgaMap["proceso_id"] = req.ProcesoID
	}
	if _, ok := mgaMap["objeto"]; !ok && req.Objeto != "" {
		mgaMap["objeto"] = req.Objeto
	}
	if b, err := json.Marshal(mgaMap); err == nil {
		project.MgaFormulationData = datatypes.JSON(b)
	}


	if err := h.db.WithContext(c.Context()).Create(&project).Error; err != nil {
		if isUniqueViolation(err) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "project with same BPIN already exists for this tenant",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create project"})
	}

	repo := postgres.NewProjectRepository(h.db)
	prog, _ := repo.CalculateProgress(c.Context(), project.ID)

	return c.Status(fiber.StatusCreated).JSON(toProjectResponse(project, prog))
}

func (h *ProjectHandler) List(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var total int64
	q := h.db.WithContext(c.Context()).
		Model(&models.Project{}).
		Where("tenant_id = ?", tenantID)

	if err := q.Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count projects"})
	}

	var projects []models.Project
	if err := q.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&projects).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list projects"})
	}

	repo := postgres.NewProjectRepository(h.db)
	projectIDs := make([]uuid.UUID, len(projects))
	for i, p := range projects {
		projectIDs[i] = p.ID
	}
	progressMap, err := repo.CalculateProgressForProjects(c.Context(), projectIDs)
	if err != nil {
		log.Printf("[ProjectHandler.List] warning: could not calculate progress: %v", err)
	}

	data := make([]dto.ProjectResponse, 0, len(projects))
	for _, p := range projects {
		prog := 0
		if progressMap != nil {
			prog = progressMap[p.ID]
		}
		data = append(data, toProjectResponse(p, prog))
	}

	totalPages := int(math.Ceil(float64(total) / float64(pageSize)))
	if totalPages == 0 {
		totalPages = 1
	}

	return c.JSON(dto.PaginatedProjectsResponse{
		Data:       data,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	})
}

func (h *ProjectHandler) GetByID(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	project, err := loadOwnedProject(h.db, c.Context(), id, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
	}

	repo := postgres.NewProjectRepository(h.db)
	prog, _ := repo.CalculateProgress(c.Context(), project.ID)

	return c.JSON(toProjectResponse(*project, prog))
}

func (h *ProjectHandler) UpdateDetails(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	var req dto.UpdateProjectDetailsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.ProblemDescription = strings.TrimSpace(req.ProblemDescription)
	req.GeneralObjective = strings.TrimSpace(req.GeneralObjective)
	req.SituacionExistente = strings.TrimSpace(req.SituacionExistente)
	req.MagnitudProblema = strings.TrimSpace(req.MagnitudProblema)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	project, err := loadOwnedProject(h.db, c.Context(), id, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
	}

	project.ProblemDescription = req.ProblemDescription
	project.GeneralObjective = req.GeneralObjective
	project.SituacionExistente = req.SituacionExistente
	project.MagnitudProblema = req.MagnitudProblema
	project.UpdatedAt = time.Now().UTC()

	repo := postgres.NewProjectRepository(h.db)
	if err := repo.UpdateProjectDetails(c.Context(), project); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update project details"})
	}

	prog, _ := repo.CalculateProgress(c.Context(), project.ID)

	return c.JSON(toProjectResponse(*project, prog))
}

func (h *ProjectHandler) Patch(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	var req dto.PatchProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	project, err := loadOwnedProject(h.db, c.Context(), id, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
	}

	if req.Name != nil {
		project.Name = *req.Name
	}
	if req.Description != nil {
		project.Description = *req.Description
	}
	if req.ProblemDescription != nil {
		project.ProblemDescription = *req.ProblemDescription
	}
	if req.GeneralObjective != nil {
		project.GeneralObjective = *req.GeneralObjective
	}
	if req.SituacionExistente != nil {
		project.SituacionExistente = *req.SituacionExistente
	}
	if req.MagnitudProblema != nil {
		project.MagnitudProblema = *req.MagnitudProblema
	}
	if req.FaseMaduracion != nil {
		project.FaseMaduracion = *req.FaseMaduracion
	}
	if req.MgaFormulationData != nil {
		var existingMap map[string]interface{}
		if len(project.MgaFormulationData) > 0 {
			if err := json.Unmarshal(project.MgaFormulationData, &existingMap); err != nil {
				existingMap = make(map[string]interface{})
			}
		} else {
			existingMap = make(map[string]interface{})
		}

		patchMap := *req.MgaFormulationData

		for k, v := range patchMap {
			existingMap[k] = v
		}

		mergedBytes, err := json.Marshal(existingMap)
		if err != nil {
			log.Printf("[PATCH Project] Error marshaling merged JSON: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to merge formulation data"})
		}

		project.MgaFormulationData = datatypes.JSON(mergedBytes)
	}

	project.UpdatedAt = time.Now().UTC()

	// Actualizar usando Updates()
	if err := h.db.WithContext(c.Context()).Model(project).Updates(project).Error; err != nil {
		log.Printf("[PATCH Project DB Error]: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": fmt.Sprintf("failed to patch project: %v", err)})
	}

	repo := postgres.NewProjectRepository(h.db)
	prog, _ := repo.CalculateProgress(c.Context(), project.ID)

	return c.JSON(toProjectResponse(*project, prog))
}

func toProjectResponse(p models.Project, progress ...int) dto.ProjectResponse {
	prog := p.Progress
	if len(progress) > 0 {
		prog = progress[0]
	}

	resp := dto.ProjectResponse{
		ID:                 p.ID.String(),
		TenantID:           p.TenantID.String(),
		CreatorID:          p.CreatorID.String(),
		Name:               p.Name,
		Description:        p.Description,
		CodeBPIN:           p.CodeBPIN,
		Sector:             p.Sector,
		ProgramCode:        p.ProgramCode,
		ProductCode:        p.ProductCode,
		ProblemDescription: p.ProblemDescription,
		GeneralObjective:   p.GeneralObjective,
		SituacionExistente: p.SituacionExistente,
		MagnitudProblema:   p.MagnitudProblema,
		FaseMaduracion:     p.FaseMaduracion,
		Status:             p.Status,
		Progress:           prog,
		Avance:             prog,
		CreatedAt:          p.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:          p.UpdatedAt.UTC().Format(time.RFC3339),
	}
	
	if p.MgaFormulationData != nil && len(p.MgaFormulationData) > 0 {
		var mgaData map[string]interface{}
		if err := json.Unmarshal(p.MgaFormulationData, &mgaData); err == nil {
			resp.MgaFormulationData = &mgaData
		}
	}
	
	if p.SectorID != nil {
		s := p.SectorID.String()
		resp.SectorID = &s
	}
	return resp
}

// GetInvestmentPipelineReport GET /api/v1/tenant/reports/investment-pipeline
func (h *ProjectHandler) GetInvestmentPipelineReport(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	repo := postgres.NewProjectRepository(h.db)
	report, err := repo.GetInvestmentPipelineReport(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate investment pipeline report: " + err.Error()})
	}

	return c.JSON(report)
}

// GetAuditRadarReport GET /api/v1/tenant/reports/audit-radar
func (h *ProjectHandler) GetAuditRadarReport(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	repo := postgres.NewProjectRepository(h.db)
	report, err := repo.GetAuditRadarReport(c.Context(), tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to generate audit radar report: " + err.Error()})
	}

	return c.JSON(report)
}


