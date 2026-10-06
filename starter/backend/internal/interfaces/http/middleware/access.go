package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"

	"aurora-backend/internal/application/access"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/modules"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EnforceMode controla qué hace RequirePermission ante una denegación (PBAC_ENFORCE).
type EnforceMode string

const (
	// EnforceOff desactiva la verificación (no consulta nada).
	EnforceOff EnforceMode = "off"
	// EnforceLog (por defecto, dry-run) evalúa y registra lo que se habría denegado, sin bloquear.
	EnforceLog EnforceMode = "log"
	// EnforceOn bloquea con 403.
	EnforceOn EnforceMode = "enforce"
)

// ParseEnforceMode normaliza PBAC_ENFORCE; cualquier valor desconocido es EnforceLog.
func ParseEnforceMode(s string) EnforceMode {
	switch EnforceMode(strings.ToLower(strings.TrimSpace(s))) {
	case EnforceOff:
		return EnforceOff
	case EnforceOn:
		return EnforceOn
	default:
		return EnforceLog
	}
}

// Códigos de error estandarizados.
const (
	CodePermissionDenied = "PERMISSION_DENIED"
	CodeSessionRevoked   = "SESSION_REVOKED"
	CodeAccessUnavail    = "ACCESS_CHECK_UNAVAILABLE"
	CodeTenantMismatch   = "TENANT_MISMATCH"
)

// AccessChecker es lo que RequirePermission necesita del AccessService.
type AccessChecker interface {
	ValidateSession(ctx context.Context, userID uuid.UUID, tokenVersion int) error
	Can(ctx context.Context, userID uuid.UUID, moduleCode string, action modules.Action) (access.Decision, error)
}

// responder produce (de forma diferida) la respuesta de error; en modo log nunca se ejecuta.
type responder func() error

// permissionDenied es el 403 estandarizado de PBAC.
func permissionDenied(c *fiber.Ctx, moduleCode string, action modules.Action, reason string) responder {
	return func() error {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":  "forbidden",
			"code":   CodePermissionDenied,
			"module": moduleCode,
			"action": string(action),
			"reason": reason,
		})
	}
}

// AccessGuard agrupa el servicio y el modo para crear middlewares por ruta.
type AccessGuard struct {
	checker AccessChecker
	mode    EnforceMode
}

// NewAccessGuard crea el guard compartido por todos los routers.
func NewAccessGuard(checker AccessChecker, mode EnforceMode) *AccessGuard {
	return &AccessGuard{checker: checker, mode: mode}
}

// Mode devuelve el modo configurado.
func (g *AccessGuard) Mode() EnforceMode { return g.mode }

// Require crea el middleware RequirePermission(moduleCode, action).
func (g *AccessGuard) Require(moduleCode string, action modules.Action) fiber.Handler {
	return RequirePermission(g.checker, g.mode, moduleCode, action)
}

// RequirePermission exige que el usuario autenticado (RequireAuth) pueda ejecutar
// `action` sobre `moduleCode`. Debe ir después de RequireAuth.
//
// Modos: off (no hace nada), log (dry-run: registra el 403 que habría devuelto y
// deja pasar) y enforce (responde 403 estandarizado). La sesión revocada
// (token_version, usuario inactivo) y los fallos del servicio siguen el mismo modo.
func RequirePermission(checker AccessChecker, mode EnforceMode, moduleCode string, action modules.Action) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if mode == EnforceOff {
			return c.Next()
		}

		userIDRaw, _ := c.Locals(LocalsUserID).(string)
		userID, err := uuid.Parse(userIDRaw)
		if err != nil {
			// Sin identidad: RequireAuth debió rechazarlo; nunca se deja pasar en enforce.
			return deny(c, mode, http401(c, "unauthorized", "UNAUTHORIZED"), "sin identidad", moduleCode, action, "")
		}
		role, _ := c.Locals(LocalsRole).(string)
		tv, _ := c.Locals(LocalsTokenVersion).(int)

		if err := checker.ValidateSession(c.UserContext(), userID, tv); err != nil {
			if errors.Is(err, access.ErrSessionRevoked) {
				return deny(c, mode, http401(c, "session revoked", CodeSessionRevoked), "sesión revocada", moduleCode, action, role)
			}
			return unavailable(c, mode, err, moduleCode, action, role)
		}

		decision, err := checker.Can(c.UserContext(), userID, moduleCode, action)
		if err != nil {
			return unavailable(c, mode, err, moduleCode, action, role)
		}
		if decision.Allowed {
			return c.Next()
		}

		return deny(c, mode, permissionDenied(c, moduleCode, action, decision.Reason), decision.Reason, moduleCode, action, role)
	}
}

func http401(c *fiber.Ctx, msg, code string) responder {
	return func() error {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": msg, "code": code})
	}
}

// deny aplica el modo: en enforce envía la respuesta; en log solo registra y deja pasar.
func deny(c *fiber.Ctx, mode EnforceMode, respond responder, reason, moduleCode string, action modules.Action, role string) error {
	userID, _ := c.Locals(LocalsUserID).(string)
	if mode == EnforceOn {
		return respond()
	}
	log.Printf("[PBAC] dry-run: se denegaría (403) user=%s role=%s module=%s action=%s reason=%s %s %s",
		userID, role, moduleCode, action, reason, c.Method(), c.Path())
	return c.Next()
}

func unavailable(c *fiber.Ctx, mode EnforceMode, err error, moduleCode string, action modules.Action, role string) error {
	userID, _ := c.Locals(LocalsUserID).(string)
	log.Printf("[PBAC] error evaluando acceso user=%s role=%s module=%s action=%s: %v", userID, role, moduleCode, action, err)
	if mode == EnforceOn {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "access check unavailable",
			"code":  CodeAccessUnavail,
		})
	}
	return c.Next()
}

// ── TenantTargetGuard ───────────────────────────────────────────────────────

// ErrTargetNotFound lo devuelve un TenantResolver cuando el recurso no existe.
var ErrTargetNotFound = errors.New("target not found")

// TenantResolver obtiene el tenant dueño del recurso/usuario objetivo de la
// petición. Debe devolver ErrTargetNotFound si no existe y (nil, nil) si el
// objetivo es global (sin tenant).
type TenantResolver func(c *fiber.Ctx) (*uuid.UUID, error)

// TenantTargetGuard garantiza que una petición que apunta a un usuario/recurso de
// un tenant solo sea accesible por actores de ese mismo tenant. SUPER_ADMIN pasa
// siempre. Un objetivo de otro tenant responde 404 (indistinguible de uno
// inexistente, para no filtrar su existencia). Siempre se aplica: es aislamiento
// multi-tenant, no depende de PBAC_ENFORCE.
func TenantTargetGuard(resolve TenantResolver) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, _ := c.Locals(LocalsRole).(string)
		if strings.EqualFold(strings.TrimSpace(role), constants.RoleSuperAdmin) {
			return c.Next()
		}

		actorTenant, err := uuid.Parse(fmt.Sprint(c.Locals(LocalsTenantID)))
		if err != nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "tenant context required",
				"code":  CodeTenantMismatch,
			})
		}

		target, err := resolve(c)
		if err != nil {
			if errors.Is(err, ErrTargetNotFound) {
				return notFound(c)
			}
			log.Printf("[PBAC] TenantTargetGuard: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to resolve target"})
		}
		if target == nil || *target != actorTenant {
			userID, _ := c.Locals(LocalsUserID).(string)
			log.Printf("[PBAC] acceso entre tenants bloqueado user=%s %s %s", userID, c.Method(), c.Path())
			return notFound(c)
		}
		return c.Next()
	}
}

func notFound(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not found"})
}

// TenantParamResolver usa un parámetro de ruta que ya es un tenant_id.
func TenantParamResolver(param string) TenantResolver {
	return func(c *fiber.Ctx) (*uuid.UUID, error) {
		id, err := uuid.Parse(c.Params(param))
		if err != nil {
			return nil, ErrTargetNotFound
		}
		return &id, nil
	}
}

// UserTenantResolver resuelve el tenant del usuario indicado en un parámetro de ruta.
func UserTenantResolver(db *gorm.DB, param string) TenantResolver {
	return func(c *fiber.Ctx) (*uuid.UUID, error) {
		id, err := uuid.Parse(c.Params(param))
		if err != nil {
			return nil, ErrTargetNotFound
		}
		var row struct{ TenantID *uuid.UUID }
		res := db.WithContext(c.UserContext()).Table("users").
			Select("tenant_id").Where("id = ? AND deleted_at IS NULL", id).Limit(1).Scan(&row)
		if res.Error != nil {
			return nil, res.Error
		}
		if res.RowsAffected == 0 {
			return nil, ErrTargetNotFound
		}
		return row.TenantID, nil
	}
}

// ── PATCH /projects/:id: autorización según lo que realmente cambia ─────────

// ProjectSnapshot es el estado almacenado de un proyecto que se compara con el PATCH.
type ProjectSnapshot struct {
	Scalars            map[string]string // columnas escalares por nombre JSON
	MgaFormulationData map[string]any
}

// ProjectSnapshotLoader carga el proyecto (con aislamiento por tenant). Devuelve
// ErrTargetNotFound si no existe o no es del tenant del actor.
type ProjectSnapshotLoader func(c *fiber.Ctx, projectID uuid.UUID) (*ProjectSnapshot, error)

// RequireProjectPatchPermission protege PATCH /projects/:id. El frontend guarda cada
// etapa de la MGA con este mismo endpoint y envía el snapshot completo, así que exigir
// una sola acción fija sería demasiado laxo (cualquier etapa) o bloquearía guardados
// legítimos. En su lugar compara el payload con lo almacenado y exige `edit` solo sobre
// los módulos/etapas cuyo contenido realmente cambia (claves desconocidas: `mga`).
// Respeta PBAC_ENFORCE como RequirePermission. Si no cambia nada, deja pasar.
func (g *AccessGuard) RequireProjectPatchPermission(load ProjectSnapshotLoader) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if g.mode == EnforceOff {
			return c.Next()
		}

		userIDRaw, _ := c.Locals(LocalsUserID).(string)
		userID, err := uuid.Parse(userIDRaw)
		if err != nil {
			return deny(c, g.mode, http401(c, "unauthorized", "UNAUTHORIZED"), "sin identidad", modules.CodeProjects, modules.ActionEdit, "")
		}
		role, _ := c.Locals(LocalsRole).(string)
		tv, _ := c.Locals(LocalsTokenVersion).(int)

		if err := g.checker.ValidateSession(c.UserContext(), userID, tv); err != nil {
			if errors.Is(err, access.ErrSessionRevoked) {
				return deny(c, g.mode, http401(c, "session revoked", CodeSessionRevoked), "sesión revocada", modules.CodeProjects, modules.ActionEdit, role)
			}
			return unavailable(c, g.mode, err, modules.CodeProjects, modules.ActionEdit, role)
		}

		projectID, err := uuid.Parse(c.Params("id"))
		var body map[string]json.RawMessage
		if err != nil || json.Unmarshal(c.Body(), &body) != nil {
			return c.Next() // el handler responde 400
		}

		snap, err := load(c, projectID)
		if err != nil {
			if errors.Is(err, ErrTargetNotFound) {
				return c.Next() // el handler responde 404
			}
			return unavailable(c, g.mode, err, modules.CodeProjects, modules.ActionEdit, role)
		}

		var scalarReqs []modules.Requirement
		for field, raw := range body {
			mod, ok := modules.ScalarModule(field)
			if !ok {
				continue
			}
			var v *string
			if json.Unmarshal(raw, &v) != nil || v == nil {
				continue
			}
			if *v != snap.Scalars[field] {
				scalarReqs = append(scalarReqs, modules.Requirement{Module: mod, Action: modules.ActionEdit})
			}
		}

		var formReqs []modules.Requirement
		if raw, ok := body["mga_formulation_data"]; ok {
			var incoming map[string]any
			if json.Unmarshal(raw, &incoming) == nil {
				formReqs = modules.RequirementsForFormulationPatch(snap.MgaFormulationData, incoming)
			}
		}

		for _, req := range modules.MergeRequirements(scalarReqs, formReqs) {
			decision, err := g.checker.Can(c.UserContext(), userID, req.Module, req.Action)
			if err != nil {
				return unavailable(c, g.mode, err, req.Module, req.Action, role)
			}
			if !decision.Allowed {
				return deny(c, g.mode, permissionDenied(c, req.Module, req.Action, decision.Reason), decision.Reason, req.Module, req.Action, role)
			}
		}
		return c.Next()
	}
}

// ProjectSnapshotFromDB carga el snapshot desde la BD con aislamiento por tenant
// (SUPER_ADMIN, sin tenant, puede ver cualquier proyecto).
func ProjectSnapshotFromDB(db *gorm.DB) ProjectSnapshotLoader {
	return func(c *fiber.Ctx, projectID uuid.UUID) (*ProjectSnapshot, error) {
		var row struct {
			Name               string
			Description        string
			ProblemDescription string
			GeneralObjective   string
			SituacionExistente string
			MagnitudProblema   string
			FaseMaduracion     string
			MgaFormulationData []byte
		}
		q := db.WithContext(c.UserContext()).Table("projects").
			Select("name, description, problem_description, general_objective, situacion_existente, magnitud_problema, fase_maduracion, mga_formulation_data").
			Where("id = ? AND deleted_at IS NULL", projectID)
		if tid, err := uuid.Parse(fmt.Sprint(c.Locals(LocalsTenantID))); err == nil {
			q = q.Where("tenant_id = ?", tid)
		} else if role, _ := c.Locals(LocalsRole).(string); !strings.EqualFold(role, constants.RoleSuperAdmin) {
			return nil, ErrTargetNotFound
		}
		res := q.Limit(1).Scan(&row)
		if res.Error != nil {
			return nil, res.Error
		}
		if res.RowsAffected == 0 {
			return nil, ErrTargetNotFound
		}
		snap := &ProjectSnapshot{
			Scalars: map[string]string{
				"name": row.Name, "description": row.Description, "problem_description": row.ProblemDescription,
				"general_objective": row.GeneralObjective, "situacion_existente": row.SituacionExistente,
				"magnitud_problema": row.MagnitudProblema, "fase_maduracion": row.FaseMaduracion,
			},
			MgaFormulationData: map[string]any{},
		}
		if len(row.MgaFormulationData) > 0 {
			_ = json.Unmarshal(row.MgaFormulationData, &snap.MgaFormulationData)
		}
		return snap, nil
	}
}
