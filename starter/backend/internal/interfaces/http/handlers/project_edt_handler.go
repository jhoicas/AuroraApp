package handlers

import (
	"errors"
	"strings"
	"time"

	appproject "aurora-backend/internal/application/project"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProjectEdtHandler struct {
	db        *gorm.DB
	repo      *postgres.ProjectEdtRepository
	catalog   *postgres.CatalogRepository
	tipologia *appproject.TipologiaService
}

func NewProjectEdtHandler(db *gorm.DB) *ProjectEdtHandler {
	catalog := postgres.NewCatalogRepository(db)
	return &ProjectEdtHandler{
		db:        db,
		repo:      postgres.NewProjectEdtRepository(db),
		catalog:   catalog,
		tipologia: appproject.NewTipologiaService(catalog),
	}
}

// LinkProduct vincula un producto DNP al proyecto y resuelve tipología / EDT.
func (h *ProjectEdtHandler) LinkProduct(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseEdtProjectContext(c)
	if err != nil {
		return err
	}

	var req dto.LinkCatalogRequest
	if err := parseAndValidateEdtBody(c, &req); err != nil {
		return err
	}

	productCode := strings.TrimSpace(req.ProductCode)
	tipologia, requiresEdt, err := h.tipologia.ResolveTipologia(c.Context(), productCode)
	if err != nil {
		if errors.Is(err, appproject.ErrProductNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "catalog product not found"})
		}
		if strings.Contains(strings.ToLower(err.Error()), "required") {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to resolve product tipologia"})
	}

	products, err := h.catalog.ListByProductCode(c.Context(), productCode)
	if err != nil || len(products) == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "catalog product not found"})
	}

	product := pickPrimaryCatalogProduct(products)
	now := time.Now().UTC()
	link := &models.ProjectCatalogLink{
		ID:          uuid.New(),
		TenantID:    tenantID,
		ProjectID:   projectID,
		ProductID:   product.ID,
		ProductCode: product.CodigoProducto,
		Tipologia:   tipologia,
		RequiresEdt: requiresEdt,
		SectorCode:  strings.TrimSpace(product.Sector),
		ProgramCode: strings.TrimSpace(product.CodigoPrograma),
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := h.repo.UpsertCatalogLink(c.Context(), link); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save catalog link"})
	}

	saved, err := h.repo.FindCatalogLink(c.Context(), projectID, tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load catalog link"})
	}

	return c.JSON(toProjectCatalogLinkResponse(*saved))
}

// GetEdtChain retorna la cadena de valor EDT completa del proyecto.
func (h *ProjectEdtHandler) GetEdtChain(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseEdtProjectContext(c)
	if err != nil {
		return err
	}

	chain, err := h.repo.GetEdtChain(c.Context(), projectID, tenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load edt chain"})
	}

	return c.JSON(toEdtChainResponse(chain))
}

// --- Nodos EDT ---

func (h *ProjectEdtHandler) CreateEdtNode(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseEdtProjectContext(c)
	if err != nil {
		return err
	}

	var req dto.CreateEdtNodeRequest
	if err := parseAndValidateEdtBody(c, &req); err != nil {
		return err
	}

	catalogEdtID, err := parseOptionalUUID(req.CatalogEdtID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid catalog_edt_id"})
	}

	now := time.Now().UTC()
	node := &models.ProjectEdtNode{
		ID:           uuid.New(),
		TenantID:     tenantID,
		ProjectID:    projectID,
		CatalogEdtID: catalogEdtID,
		Code:         strings.TrimSpace(req.Code),
		Level:        req.Level,
		Name:         strings.TrimSpace(req.Name),
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := h.repo.CreateEdtNode(c.Context(), node); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create edt node"})
	}

	return c.Status(fiber.StatusCreated).JSON(toProjectEdtNodeResponse(*node))
}

func (h *ProjectEdtHandler) UpdateEdtNode(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseEdtProjectContext(c)
	if err != nil {
		return err
	}

	nodeID, err := uuid.Parse(c.Params("nodeId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid node id"})
	}

	node, err := h.repo.FindEdtNode(c.Context(), nodeID, projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "edt node not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load edt node"})
	}

	var req dto.UpdateEdtNodeRequest
	if err := parseAndValidateEdtBody(c, &req); err != nil {
		return err
	}

	if req.CatalogEdtID != nil {
		if strings.TrimSpace(*req.CatalogEdtID) == "" {
			node.CatalogEdtID = nil
		} else {
			parsed, parseErr := uuid.Parse(strings.TrimSpace(*req.CatalogEdtID))
			if parseErr != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid catalog_edt_id"})
			}
			node.CatalogEdtID = &parsed
		}
	}
	if req.Code != nil {
		node.Code = strings.TrimSpace(*req.Code)
	}
	if req.Level != nil {
		node.Level = *req.Level
	}
	if req.Name != nil {
		node.Name = strings.TrimSpace(*req.Name)
	}
	node.UpdatedAt = time.Now().UTC()

	if err := h.repo.UpdateEdtNode(c.Context(), node); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update edt node"})
	}

	return c.JSON(toProjectEdtNodeResponse(*node))
}

func (h *ProjectEdtHandler) DeleteEdtNode(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseEdtProjectContext(c)
	if err != nil {
		return err
	}

	nodeID, err := uuid.Parse(c.Params("nodeId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid node id"})
	}

	if err := h.repo.DeleteEdtNode(c.Context(), nodeID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "edt node not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete edt node"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// --- Entregables ---

func (h *ProjectEdtHandler) CreateDeliverable(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseEdtProjectContext(c)
	if err != nil {
		return err
	}

	var req dto.CreateDeliverableRequest
	if err := parseAndValidateEdtBody(c, &req); err != nil {
		return err
	}

	nodeID, err := uuid.Parse(strings.TrimSpace(req.ProjectEdtNodeID))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project_edt_node_id"})
	}

	if _, err := h.repo.FindEdtNode(c.Context(), nodeID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "edt node not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify edt node"})
	}

	catalogDeliverableID, err := parseOptionalUUID(req.CatalogDeliverableID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid catalog_deliverable_id"})
	}

	now := time.Now().UTC()
	item := &models.ProjectDeliverable{
		ID:                   uuid.New(),
		TenantID:             tenantID,
		ProjectID:            projectID,
		ProjectEdtNodeID:     nodeID,
		CatalogDeliverableID: catalogDeliverableID,
		Code:                 strings.TrimSpace(req.Code),
		Name:                 strings.TrimSpace(req.Name),
		Amount:               req.Amount,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if err := h.repo.CreateDeliverable(c.Context(), item); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create deliverable"})
	}

	return c.Status(fiber.StatusCreated).JSON(toProjectDeliverableResponse(*item))
}

func (h *ProjectEdtHandler) UpdateDeliverable(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseEdtProjectContext(c)
	if err != nil {
		return err
	}

	deliverableID, err := uuid.Parse(c.Params("delivId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid deliverable id"})
	}

	item, err := h.repo.FindDeliverable(c.Context(), deliverableID, projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "deliverable not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load deliverable"})
	}

	var req dto.UpdateDeliverableRequest
	if err := parseAndValidateEdtBody(c, &req); err != nil {
		return err
	}

	if req.ProjectEdtNodeID != nil {
		nodeID, parseErr := uuid.Parse(strings.TrimSpace(*req.ProjectEdtNodeID))
		if parseErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project_edt_node_id"})
		}
		if _, findErr := h.repo.FindEdtNode(c.Context(), nodeID, projectID, tenantID); findErr != nil {
			if isNotFound(findErr) {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "edt node not found"})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify edt node"})
		}
		item.ProjectEdtNodeID = nodeID
	}
	if req.CatalogDeliverableID != nil {
		if strings.TrimSpace(*req.CatalogDeliverableID) == "" {
			item.CatalogDeliverableID = nil
		} else {
			parsed, parseErr := uuid.Parse(strings.TrimSpace(*req.CatalogDeliverableID))
			if parseErr != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid catalog_deliverable_id"})
			}
			item.CatalogDeliverableID = &parsed
		}
	}
	if req.Code != nil {
		item.Code = strings.TrimSpace(*req.Code)
	}
	if req.Name != nil {
		item.Name = strings.TrimSpace(*req.Name)
	}
	if req.Amount != nil {
		item.Amount = *req.Amount
	}
	item.UpdatedAt = time.Now().UTC()

	if err := h.repo.UpdateDeliverable(c.Context(), item); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update deliverable"})
	}

	return c.JSON(toProjectDeliverableResponse(*item))
}

func (h *ProjectEdtHandler) DeleteDeliverable(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseEdtProjectContext(c)
	if err != nil {
		return err
	}

	deliverableID, err := uuid.Parse(c.Params("delivId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid deliverable id"})
	}

	if err := h.repo.DeleteDeliverable(c.Context(), deliverableID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "deliverable not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete deliverable"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// --- Actividades ---

func (h *ProjectEdtHandler) CreateActivity(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseEdtProjectContext(c)
	if err != nil {
		return err
	}

	var req dto.CreateActivityRequest
	if err := parseAndValidateEdtBody(c, &req); err != nil {
		return err
	}

	deliverableID, err := uuid.Parse(strings.TrimSpace(req.ProjectDeliverableID))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project_deliverable_id"})
	}

	if _, err := h.repo.FindDeliverable(c.Context(), deliverableID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "deliverable not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify deliverable"})
	}

	catalogActivityID, err := parseOptionalUUID(req.CatalogActivityID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid catalog_activity_id"})
	}

	now := time.Now().UTC()
	item := &models.ProjectActivity{
		ID:                   uuid.New(),
		TenantID:             tenantID,
		ProjectID:            projectID,
		ProjectDeliverableID: deliverableID,
		CatalogActivityID:    catalogActivityID,
		Code:                 strings.TrimSpace(req.Code),
		Name:                 strings.TrimSpace(req.Name),
		Quantity:             req.Quantity,
		UnitCost:             req.UnitCost,
		TotalCost:            req.Quantity * req.UnitCost,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if err := h.repo.CreateActivity(c.Context(), item); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to create activity"})
	}

	return c.Status(fiber.StatusCreated).JSON(toProjectActivityResponse(*item))
}

func (h *ProjectEdtHandler) UpdateActivity(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseEdtProjectContext(c)
	if err != nil {
		return err
	}

	activityID, err := uuid.Parse(c.Params("actId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid activity id"})
	}

	item, err := h.repo.FindActivity(c.Context(), activityID, projectID, tenantID)
	if err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "activity not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load activity"})
	}

	var req dto.UpdateActivityRequest
	if err := parseAndValidateEdtBody(c, &req); err != nil {
		return err
	}

	if req.ProjectDeliverableID != nil {
		deliverableID, parseErr := uuid.Parse(strings.TrimSpace(*req.ProjectDeliverableID))
		if parseErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project_deliverable_id"})
		}
		if _, findErr := h.repo.FindDeliverable(c.Context(), deliverableID, projectID, tenantID); findErr != nil {
			if isNotFound(findErr) {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "deliverable not found"})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify deliverable"})
		}
		item.ProjectDeliverableID = deliverableID
	}
	if req.CatalogActivityID != nil {
		if strings.TrimSpace(*req.CatalogActivityID) == "" {
			item.CatalogActivityID = nil
		} else {
			parsed, parseErr := uuid.Parse(strings.TrimSpace(*req.CatalogActivityID))
			if parseErr != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid catalog_activity_id"})
			}
			item.CatalogActivityID = &parsed
		}
	}
	if req.Code != nil {
		item.Code = strings.TrimSpace(*req.Code)
	}
	if req.Name != nil {
		item.Name = strings.TrimSpace(*req.Name)
	}
	if req.Quantity != nil {
		item.Quantity = *req.Quantity
	}
	if req.UnitCost != nil {
		item.UnitCost = *req.UnitCost
	}
	if req.TotalCost != nil {
		item.TotalCost = *req.TotalCost
	} else if req.Quantity != nil || req.UnitCost != nil {
		item.TotalCost = item.Quantity * item.UnitCost
	}
	item.UpdatedAt = time.Now().UTC()

	if err := h.repo.UpdateActivity(c.Context(), item); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to update activity"})
	}

	return c.JSON(toProjectActivityResponse(*item))
}

func (h *ProjectEdtHandler) DeleteActivity(c *fiber.Ctx) error {
	projectID, tenantID, err := h.parseEdtProjectContext(c)
	if err != nil {
		return err
	}

	activityID, err := uuid.Parse(c.Params("actId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid activity id"})
	}

	if err := h.repo.DeleteActivity(c.Context(), activityID, projectID, tenantID); err != nil {
		if isNotFound(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "activity not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to delete activity"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// --- Helpers ---

func (h *ProjectEdtHandler) parseEdtProjectContext(c *fiber.Ctx) (uuid.UUID, uuid.UUID, error) {
	_, tenantID, err := httpmw.IdentityFromContext(c)
	if err != nil {
		return uuid.Nil, uuid.Nil, c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
	}

	projectID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, uuid.Nil, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid project id"})
	}

	if _, err := loadOwnedProject(h.db, c.Context(), projectID, tenantID); err != nil {
		if isNotFound(err) {
			return uuid.Nil, uuid.Nil, c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "project not found"})
		}
		return uuid.Nil, uuid.Nil, c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to verify project ownership"})
	}

	return projectID, tenantID, nil
}

func parseAndValidateEdtBody(c *fiber.Ctx, req any) error {
	if err := c.BodyParser(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if err := dto.Validate(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	return nil
}

func parseOptionalUUID(raw *string) (*uuid.UUID, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil, nil
	}
	parsed, err := uuid.Parse(strings.TrimSpace(*raw))
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func pickPrimaryCatalogProduct(products []models.CatalogProduct) models.CatalogProduct {
	for _, p := range products {
		if p.IndicadorPrincipal {
			return p
		}
	}
	return products[0]
}

func toEdtChainResponse(chain *postgres.ProjectEdtChain) dto.EdtChainResponse {
	resp := dto.EdtChainResponse{
		EdtNodes:     make([]dto.ProjectEdtNodeResponse, 0, len(chain.EdtNodes)),
		Deliverables: make([]dto.ProjectDeliverableResponse, 0, len(chain.Deliverables)),
		Activities:   make([]dto.ProjectActivityResponse, 0, len(chain.Activities)),
	}

	if chain.CatalogLink != nil {
		link := toProjectCatalogLinkResponse(*chain.CatalogLink)
		resp.CatalogLink = &link
	}

	for _, node := range chain.EdtNodes {
		resp.EdtNodes = append(resp.EdtNodes, toProjectEdtNodeResponse(node))
	}
	for _, item := range chain.Deliverables {
		resp.Deliverables = append(resp.Deliverables, toProjectDeliverableResponse(item))
	}
	for _, item := range chain.Activities {
		resp.Activities = append(resp.Activities, toProjectActivityResponse(item))
	}

	return resp
}

func toProjectCatalogLinkResponse(link models.ProjectCatalogLink) dto.ProjectCatalogLinkResponse {
	return dto.ProjectCatalogLinkResponse{
		ID:          link.ID.String(),
		TenantID:    link.TenantID.String(),
		ProjectID:   link.ProjectID.String(),
		ProductID:   link.ProductID.String(),
		ProductCode: link.ProductCode,
		Tipologia:   link.Tipologia,
		RequiresEdt: link.RequiresEdt,
		SectorCode:  link.SectorCode,
		ProgramCode: link.ProgramCode,
		CreatedAt:   link.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:   link.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func toProjectEdtNodeResponse(node models.ProjectEdtNode) dto.ProjectEdtNodeResponse {
	var catalogEdtID *string
	if node.CatalogEdtID != nil {
		s := node.CatalogEdtID.String()
		catalogEdtID = &s
	}

	return dto.ProjectEdtNodeResponse{
		ID:           node.ID.String(),
		TenantID:     node.TenantID.String(),
		ProjectID:    node.ProjectID.String(),
		CatalogEdtID: catalogEdtID,
		Code:         node.Code,
		Level:        node.Level,
		Name:         node.Name,
		CreatedAt:    node.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:    node.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func toProjectDeliverableResponse(item models.ProjectDeliverable) dto.ProjectDeliverableResponse {
	var catalogDeliverableID *string
	if item.CatalogDeliverableID != nil {
		s := item.CatalogDeliverableID.String()
		catalogDeliverableID = &s
	}

	return dto.ProjectDeliverableResponse{
		ID:                   item.ID.String(),
		TenantID:             item.TenantID.String(),
		ProjectID:            item.ProjectID.String(),
		ProjectEdtNodeID:     item.ProjectEdtNodeID.String(),
		CatalogDeliverableID: catalogDeliverableID,
		Code:                 item.Code,
		Name:                 item.Name,
		Amount:               item.Amount,
		CreatedAt:            item.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:            item.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func toProjectActivityResponse(item models.ProjectActivity) dto.ProjectActivityResponse {
	var catalogActivityID *string
	if item.CatalogActivityID != nil {
		s := item.CatalogActivityID.String()
		catalogActivityID = &s
	}

	return dto.ProjectActivityResponse{
		ID:                   item.ID.String(),
		TenantID:             item.TenantID.String(),
		ProjectID:            item.ProjectID.String(),
		ProjectDeliverableID: item.ProjectDeliverableID.String(),
		CatalogActivityID:    catalogActivityID,
		Code:                 item.Code,
		Name:                 item.Name,
		Quantity:             item.Quantity,
		UnitCost:             item.UnitCost,
		TotalCost:            item.TotalCost,
		CreatedAt:            item.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:            item.UpdatedAt.UTC().Format(time.RFC3339),
	}
}
