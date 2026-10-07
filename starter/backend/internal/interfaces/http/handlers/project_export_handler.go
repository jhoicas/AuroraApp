package handlers

import (
	"errors"
	"fmt"
	"strings"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProjectExportHandler gestiona la exportación de documentos técnicos y reportes de proyectos.
type ProjectExportHandler struct {
	db                  *gorm.DB
	mgaRepo             *postgres.MgaRepository
	edtRepo             *postgres.ProjectEdtRepository
	valleDocumentExport *appproject.TechnicalDocumentValleService
	templateRepo        *postgres.DocumentTemplateRepository
	templateRender      *appproject.DocumentTemplateService
}

func NewProjectExportHandler(db *gorm.DB) *ProjectExportHandler {
	return &ProjectExportHandler{
		db:                  db,
		mgaRepo:             postgres.NewMgaRepository(db),
		edtRepo:             postgres.NewProjectEdtRepository(db),
		valleDocumentExport: appproject.NewTechnicalDocumentValleService(),
		templateRepo:        postgres.NewDocumentTemplateRepository(db),
		templateRender:      appproject.NewDocumentTemplateService(),
	}
}

// ExportTechnicalDocumentValle genera y descarga el Documento Técnico del Proyecto de Inversión
// exigido por el Decreto 1278 de 2023 del Valle del Cauca (Art. 13, literal e).
func (h *ProjectExportHandler) ExportTechnicalDocumentValle(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	// Cargar proyecto verificando pertenencia al tenant y precargando información institucional
	var project models.Project
	if err := h.db.WithContext(c.Context()).
		Preload("Tenant").
		Where("id = ? AND tenant_id = ?", projectID, tenantID).
		First(&project).Error; err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
	}

	// Cargar formulación MGA completa (causas, efectos, objetivos, población, alternativas)
	mgaBundle, err := h.mgaRepo.GetFullFormulation(c.Context(), projectID, tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load mga formulation"})
	}

	// Cargar cadena de valor EDT (producto catálogo, componentes, entregables, actividades)
	edtChain, err := h.edtRepo.GetEdtChain(c.Context(), projectID, tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load edt chain"})
	}

	// Generar PDF del Documento Técnico
	pdfBytes, err := h.valleDocumentExport.GenerateValleDocumentPDF(&project, mgaBundle, edtChain)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("failed to generate technical document: %v", err),
		})
	}

	// Sanitizar nombre para encabezado de descarga
	cleanName := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			return r
		}
		return '_'
	}, project.Name)
	if len(cleanName) > 40 {
		cleanName = cleanName[:40]
	}
	filename := fmt.Sprintf("Documento_Tecnico_Valle_%s.pdf", cleanName)

	c.Set("Content-Type", "application/pdf")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))

	return c.Send(pdfBytes)
}

// ExportTechnicalDocument genera el PDF del Documento Técnico con la plantilla activa del tenant
// (is_active) o, si no hay, la plantilla global del sistema (is_system_default). Si tampoco
// existe ninguna plantilla sembrada, usa el generador Valle original.
func (h *ProjectExportHandler) ExportTechnicalDocument(c *fiber.Ctx) error {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}
	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	tpl, err := h.templateRepo.Resolve(c.Context(), tenantID)
	if err != nil {
		if errors.Is(err, postgres.ErrTemplateNotFound) {
			return h.ExportTechnicalDocumentValle(c)
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to resolve template"})
	}

	var project models.Project
	if err := h.db.WithContext(c.Context()).Preload("Tenant").
		Where("id = ? AND tenant_id = ?", projectID, tenantID).First(&project).Error; err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load project"})
	}
	bundle, err := h.mgaRepo.GetFullFormulation(c.Context(), projectID, tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load mga formulation"})
	}
	var budget []models.BudgetItem
	if err := h.db.WithContext(c.Context()).
		Where("project_id = ? AND tenant_id = ?", projectID, tenantID).
		Order("created_at ASC").Find(&budget).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load budget"})
	}

	pdfBytes, err := h.templateRender.RenderPDF(tpl, appproject.BuildTemplateData(&project, bundle, budget))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("failed to generate technical document: %v", err),
		})
	}

	c.Set("Content-Type", "application/pdf")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"Documento_Tecnico_%s.pdf\"", projectID))
	c.Set("Content-Length", fmt.Sprintf("%d", len(pdfBytes)))
	return c.Send(pdfBytes)
}
