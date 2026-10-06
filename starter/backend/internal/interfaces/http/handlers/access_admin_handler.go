package handlers

import (
	"errors"
	"log"
	"strconv"
	"strings"

	"aurora-backend/internal/application/accessadmin"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// AccessAdminHandler expone la API de administración de acceso (solo SUPER_ADMIN).
type AccessAdminHandler struct {
	svc *accessadmin.Service
}

func NewAccessAdminHandler(svc *accessadmin.Service) *AccessAdminHandler {
	return &AccessAdminHandler{svc: svc}
}

func actorFrom(c *fiber.Ctx) (accessadmin.Actor, error) {
	raw, _ := c.Locals(httpmw.LocalsUserID).(string)
	id, err := uuid.Parse(raw)
	if err != nil {
		return accessadmin.Actor{}, err
	}
	return accessadmin.Actor{UserID: id}, nil
}

// respondAccessAdminError traduce los errores tipados del servicio a HTTP.
func respondAccessAdminError(c *fiber.Ctx, err error) error {
	pick := func(status int, sentinel error) error {
		msg := strings.TrimPrefix(err.Error(), sentinel.Error()+": ")
		return c.Status(status).JSON(fiber.Map{"error": msg})
	}
	switch {
	case errors.Is(err, accessadmin.ErrSessionRevoked):
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "session revoked", "code": httpmw.CodeSessionRevoked})
	case errors.Is(err, accessadmin.ErrValidation):
		return pick(fiber.StatusBadRequest, accessadmin.ErrValidation)
	case errors.Is(err, accessadmin.ErrNotFound):
		return pick(fiber.StatusNotFound, accessadmin.ErrNotFound)
	case errors.Is(err, accessadmin.ErrConflict):
		return pick(fiber.StatusConflict, accessadmin.ErrConflict)
	case errors.Is(err, accessadmin.ErrForbidden):
		return pick(fiber.StatusForbidden, accessadmin.ErrForbidden)
	}
	log.Printf("access admin: %v", err)
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal error"})
}

// paramUUID lee un parámetro UUID; devuelve false (ya respondido con 400) si es inválido.
func paramUUID(c *fiber.Ctx, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Params(name))
	if err != nil {
		_ = c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid " + name})
		return uuid.Nil, false
	}
	return id, true
}

// bind lee el JSON del cuerpo; devuelve false (ya respondido) si es inválido.
func bind(c *fiber.Ctx, dst any) bool {
	if err := c.BodyParser(dst); err != nil {
		_ = c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
		return false
	}
	return true
}

// ── Módulos ────────────────────────────────────────────────────────────────

func (h *AccessAdminHandler) ListModules(c *fiber.Ctx) error {
	mods, err := h.svc.ListModules(c.UserContext())
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(fiber.Map{"data": mods})
}

func (h *AccessAdminHandler) CreateModule(c *fiber.Ctx) error {
	actor, err := actorFrom(c)
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	var in accessadmin.CreateModuleInput
	if !bind(c, &in) {
		return nil
	}
	m, err := h.svc.CreateModule(c.UserContext(), actor, in)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(m)
}

func (h *AccessAdminHandler) UpdateModule(c *fiber.Ctx) error {
	actor, err := actorFrom(c)
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	var in accessadmin.UpdateModuleInput
	if !bind(c, &in) {
		return nil
	}
	m, err := h.svc.UpdateModule(c.UserContext(), actor, id, in)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(m)
}

func (h *AccessAdminHandler) DeleteModule(c *fiber.Ctx) error {
	actor, err := actorFrom(c)
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	if err := h.svc.DeleteModule(c.UserContext(), actor, id); err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AccessAdminHandler) ReorderModules(c *fiber.Ctx) error {
	actor, err := actorFrom(c)
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	var body struct {
		Items []accessadmin.ReorderItem `json:"items"`
	}
	if !bind(c, &body) {
		return nil
	}
	if err := h.svc.ReorderModules(c.UserContext(), actor, body.Items); err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ── Tenants ────────────────────────────────────────────────────────────────

func (h *AccessAdminHandler) GetTenantModules(c *fiber.Ctx) error {
	tenantID, ok := paramUUID(c, "tenantId")
	if !ok {
		return nil
	}
	mods, err := h.svc.GetTenantModules(c.UserContext(), tenantID)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(fiber.Map{"data": mods})
}

func (h *AccessAdminHandler) SetTenantModules(c *fiber.Ctx) error {
	actor, err := actorFrom(c)
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	tenantID, ok := paramUUID(c, "tenantId")
	if !ok {
		return nil
	}
	var body struct {
		Modules []accessadmin.TenantModuleChange `json:"modules"`
	}
	if !bind(c, &body) {
		return nil
	}
	if err := h.svc.SetTenantModules(c.UserContext(), actor, tenantID, body.Modules); err != nil {
		return respondAccessAdminError(c, err)
	}
	mods, err := h.svc.GetTenantModules(c.UserContext(), tenantID)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(fiber.Map{"data": mods})
}

func (h *AccessAdminHandler) ListTenantUsers(c *fiber.Ctx) error {
	tenantID, ok := paramUUID(c, "tenantId")
	if !ok {
		return nil
	}
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	users, total, err := h.svc.ListTenantUsers(c.UserContext(), tenantID, limit, offset)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(fiber.Map{"data": users, "total": total, "limit": limit, "offset": offset})
}

func (h *AccessAdminHandler) CreateTenantUser(c *fiber.Ctx) error {
	actor, err := actorFrom(c)
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	tenantID, ok := paramUUID(c, "tenantId")
	if !ok {
		return nil
	}
	var in accessadmin.CreateUserInput
	if !bind(c, &in) {
		return nil
	}
	u, err := h.svc.CreateTenantUser(c.UserContext(), actor, tenantID, in)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(u)
}

// ── Usuarios ───────────────────────────────────────────────────────────────

func (h *AccessAdminHandler) GetUserPermissions(c *fiber.Ctx) error {
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	p, err := h.svc.GetUserPermissions(c.UserContext(), id)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(p)
}

func (h *AccessAdminHandler) SetUserPermissions(c *fiber.Ctx) error {
	actor, err := actorFrom(c)
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	var body struct {
		Permissions []accessadmin.PermissionInput `json:"permissions"`
	}
	if !bind(c, &body) {
		return nil
	}
	if err := h.svc.SetUserPermissions(c.UserContext(), actor, id, body.Permissions); err != nil {
		return respondAccessAdminError(c, err)
	}
	p, err := h.svc.GetUserPermissions(c.UserContext(), id)
	if err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.JSON(p)
}

func (h *AccessAdminHandler) SetUserPassword(c *fiber.Ctx) error {
	actor, err := actorFrom(c)
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	var body struct {
		NewPassword string `json:"new_password"`
	}
	if !bind(c, &body) {
		return nil
	}
	if err := h.svc.SetUserPassword(c.UserContext(), actor, id, body.NewPassword); err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AccessAdminHandler) SetUserStatus(c *fiber.Ctx) error {
	actor, err := actorFrom(c)
	if err != nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	id, ok := paramUUID(c, "id")
	if !ok {
		return nil
	}
	var body struct {
		IsActive *bool `json:"is_active"`
	}
	if !bind(c, &body) {
		return nil
	}
	if body.IsActive == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "is_active es obligatorio"})
	}
	if err := h.svc.SetUserStatus(c.UserContext(), actor, id, *body.IsActive); err != nil {
		return respondAccessAdminError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}
