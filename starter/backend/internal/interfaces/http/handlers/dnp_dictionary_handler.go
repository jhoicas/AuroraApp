package handlers

import (
	"strconv"
	"strings"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// DnpDictionaryHandler expone los diccionarios DNP (verbos y unidades estándar).
// Escrituras: solo SUPER_ADMIN (grupo /api/v1/admin/catalogs).
type DnpDictionaryHandler struct {
	repo *postgres.DnpDictionaryRepository
}

func NewDnpDictionaryHandler(db *gorm.DB) *DnpDictionaryHandler {
	return &DnpDictionaryHandler{repo: postgres.NewDnpDictionaryRepository(db)}
}

func dnpListParams(c *fiber.Ctx) postgres.DnpListParams {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	search := strings.TrimSpace(c.Query("search"))
	if search == "" {
		search = strings.TrimSpace(c.Query("q"))
	}
	return postgres.DnpListParams{
		Search:   search,
		Kind:     c.Query("kind"),
		Typology: c.Query("typology"),
		Page:     page,
		Limit:    limit,
	}
}

func dnpParseID(c *fiber.Ctx) (uint, bool) {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return 0, false
	}
	return uint(id), true
}

func dnpWriteError(c *fiber.Ctx, err error, entity string) error {
	switch {
	case postgres.IsDnpNotFound(err):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": entity + " not found"})
	case postgres.IsDnpDuplicate(err):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": entity + " already exists"})
	default:
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save " + entity})
	}
}

// Dictionary devuelve los diccionarios completos para formularios de tenant.
// GET /api/v1/catalog/dnp-dictionary
func (h *DnpDictionaryHandler) Dictionary(c *fiber.Ctx) error {
	verbs, err := h.repo.ListVerbs(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list dnp verbs"})
	}
	units, err := h.repo.ListUnits(c.Context(), true)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list dnp units"})
	}
	resp := dto.DnpDictionaryResponse{StrongVerbs: []string{}, WeakVerbs: []string{}, Units: units}
	for _, v := range verbs {
		if v.Kind == models.DnpVerbKindWeak {
			resp.WeakVerbs = append(resp.WeakVerbs, v.Verb)
		} else {
			resp.StrongVerbs = append(resp.StrongVerbs, v.Verb)
		}
	}
	return c.JSON(resp)
}

// ---------- Verbos (admin) ----------

// ListVerbs GET /api/v1/admin/catalogs/dnp-verbs?kind=&search=&page=&limit=
func (h *DnpDictionaryHandler) ListVerbs(c *fiber.Ctx) error {
	res, err := h.repo.ListVerbsPaginated(c.Context(), dnpListParams(c))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list dnp verbs"})
	}
	return c.JSON(dto.PaginatedDnpVerbsResponse{
		Data: res.Items,
		Meta: dto.PaginationMeta{Total: res.Total, Page: res.Page, Limit: res.Limit, LastPage: res.LastPage},
	})
}

func parseVerbBody(c *fiber.Ctx) (*models.DnpVerb, error) {
	var req dto.UpsertDnpVerbRequest
	if err := c.BodyParser(&req); err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, "invalid JSON body")
	}
	req.Verb = strings.TrimSpace(req.Verb)
	req.Kind = strings.ToUpper(strings.TrimSpace(req.Kind))
	req.Notes = strings.TrimSpace(req.Notes)
	if err := dto.Validate(&req); err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	if strings.ContainsAny(req.Verb, " \t") {
		return nil, fiber.NewError(fiber.StatusBadRequest, "verb must be a single word in infinitive")
	}
	return &models.DnpVerb{Verb: req.Verb, Kind: req.Kind, Notes: req.Notes}, nil
}

func dnpBadRequest(c *fiber.Ctx, err error) error {
	if fe, ok := err.(*fiber.Error); ok {
		return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
	}
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
}

// CreateVerb POST /api/v1/admin/catalogs/dnp-verbs
func (h *DnpDictionaryHandler) CreateVerb(c *fiber.Ctx) error {
	verb, err := parseVerbBody(c)
	if err != nil {
		return dnpBadRequest(c, err)
	}
	if err := h.repo.CreateVerb(c.Context(), verb); err != nil {
		return dnpWriteError(c, err, "dnp verb")
	}
	return c.Status(fiber.StatusCreated).JSON(verb)
}

// UpdateVerb PUT /api/v1/admin/catalogs/dnp-verbs/:id
func (h *DnpDictionaryHandler) UpdateVerb(c *fiber.Ctx) error {
	id, ok := dnpParseID(c)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid dnp verb id"})
	}
	verb, err := parseVerbBody(c)
	if err != nil {
		return dnpBadRequest(c, err)
	}
	verb.ID = id
	if err := h.repo.UpdateVerb(c.Context(), verb); err != nil {
		return dnpWriteError(c, err, "dnp verb")
	}
	return c.JSON(verb)
}

// DeleteVerb DELETE /api/v1/admin/catalogs/dnp-verbs/:id
func (h *DnpDictionaryHandler) DeleteVerb(c *fiber.Ctx) error {
	id, ok := dnpParseID(c)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid dnp verb id"})
	}
	if err := h.repo.DeleteVerb(c.Context(), id); err != nil {
		return dnpWriteError(c, err, "dnp verb")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ---------- Unidades (admin) ----------

// ListUnits GET /api/v1/admin/catalogs/dnp-units?typology=&search=&page=&limit=
func (h *DnpDictionaryHandler) ListUnits(c *fiber.Ctx) error {
	res, err := h.repo.ListUnitsPaginated(c.Context(), dnpListParams(c))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list dnp units"})
	}
	return c.JSON(dto.PaginatedDnpUnitsResponse{
		Data: res.Items,
		Meta: dto.PaginationMeta{Total: res.Total, Page: res.Page, Limit: res.Limit, LastPage: res.LastPage},
	})
}

func parseUnitBody(c *fiber.Ctx) (*models.DnpStandardUnit, error) {
	var req dto.UpsertDnpUnitRequest
	if err := c.BodyParser(&req); err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, "invalid JSON body")
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Symbol = strings.TrimSpace(req.Symbol)
	req.Typology = strings.ToUpper(strings.TrimSpace(req.Typology))
	if err := dto.Validate(&req); err != nil {
		return nil, fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	return &models.DnpStandardUnit{Name: req.Name, Symbol: req.Symbol, Typology: req.Typology, Active: active}, nil
}

// CreateUnit POST /api/v1/admin/catalogs/dnp-units
func (h *DnpDictionaryHandler) CreateUnit(c *fiber.Ctx) error {
	unit, err := parseUnitBody(c)
	if err != nil {
		return dnpBadRequest(c, err)
	}
	if err := h.repo.CreateUnit(c.Context(), unit); err != nil {
		return dnpWriteError(c, err, "dnp unit")
	}
	return c.Status(fiber.StatusCreated).JSON(unit)
}

// UpdateUnit PUT /api/v1/admin/catalogs/dnp-units/:id
func (h *DnpDictionaryHandler) UpdateUnit(c *fiber.Ctx) error {
	id, ok := dnpParseID(c)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid dnp unit id"})
	}
	unit, err := parseUnitBody(c)
	if err != nil {
		return dnpBadRequest(c, err)
	}
	unit.ID = id
	if err := h.repo.UpdateUnit(c.Context(), unit); err != nil {
		return dnpWriteError(c, err, "dnp unit")
	}
	return c.JSON(unit)
}

// DeleteUnit DELETE /api/v1/admin/catalogs/dnp-units/:id
func (h *DnpDictionaryHandler) DeleteUnit(c *fiber.Ctx) error {
	id, ok := dnpParseID(c)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid dnp unit id"})
	}
	if err := h.repo.DeleteUnit(c.Context(), id); err != nil {
		return dnpWriteError(c, err, "dnp unit")
	}
	return c.SendStatus(fiber.StatusNoContent)
}
