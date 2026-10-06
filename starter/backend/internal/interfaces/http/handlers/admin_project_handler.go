package handlers

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AdminProjectHandler expone la vista global de proyectos (solo SUPER_ADMIN).
type AdminProjectHandler struct {
	db *gorm.DB
}

func NewAdminProjectHandler(db *gorm.DB) *AdminProjectHandler {
	return &AdminProjectHandler{db: db}
}

// AdminProjectRow es un proyecto con su entidad y su creador.
type AdminProjectRow struct {
	ID             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	CodeBPIN       *string   `json:"code_bpin,omitempty"`
	Status         string    `json:"status"`
	FaseMaduracion string    `json:"fase_maduracion"`
	Sector         string    `json:"sector,omitempty"`
	TenantID       uuid.UUID `json:"tenant_id"`
	TenantName     string    `json:"tenant_name"`
	CreatorID      uuid.UUID `json:"creator_id"`
	CreatorEmail   string    `json:"creator_email"`
	CreatorName    string    `json:"creator_name"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// parseFilterDate acepta YYYY-MM-DD o RFC3339.
func parseFilterDate(raw string) (time.Time, bool, error) {
	if raw == "" {
		return time.Time{}, false, nil
	}
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		return t.UTC(), true, nil
	}
	t, err := time.Parse(time.RFC3339, raw)
	return t.UTC(), false, err
}

// List devuelve los proyectos de todas las entidades.
// GET /api/v1/admin/projects?tenant_id&created_by&start_date&end_date&page&limit
// created_by es un UUID de usuario o (parte de) un email. end_date es inclusivo cuando es una fecha.
func (h *AdminProjectHandler) List(c *fiber.Ctx) error {
	page, limit := parsePage(c, 20, 100)

	q := h.db.WithContext(c.UserContext()).
		Table("projects AS p").
		Joins("JOIN tenants t ON t.id = p.tenant_id").
		Joins("JOIN users u ON u.id = p.creator_id").
		Where("p.deleted_at IS NULL")

	if raw := strings.TrimSpace(c.Query("tenant_id")); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid tenant_id"})
		}
		q = q.Where("p.tenant_id = ?", id)
	}
	if raw := strings.TrimSpace(c.Query("created_by")); raw != "" {
		if id, err := uuid.Parse(raw); err == nil {
			q = q.Where("p.creator_id = ?", id)
		} else {
			like := "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(strings.ToLower(raw)) + "%"
			q = q.Where(`LOWER(u.email) LIKE ? ESCAPE '\'`, like)
		}
	}
	start, _, err := parseFilterDate(strings.TrimSpace(c.Query("start_date")))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid start_date"})
	}
	if !start.IsZero() {
		q = q.Where("p.created_at >= ?", start)
	}
	end, dateOnly, err := parseFilterDate(strings.TrimSpace(c.Query("end_date")))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid end_date"})
	}
	if !end.IsZero() {
		if dateOnly {
			q = q.Where("p.created_at < ?", end.AddDate(0, 0, 1))
		} else {
			q = q.Where("p.created_at <= ?", end)
		}
	}
	if !start.IsZero() && !end.IsZero() && end.Before(start) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "end_date must not be before start_date"})
	}

	var total int64
	if err := q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count projects"})
	}

	rows := make([]AdminProjectRow, 0, limit)
	if err := q.Select(`p.id, p.name, p.code_bpin, p.status, p.fase_maduracion, p.sector,
			p.tenant_id, t.name AS tenant_name, p.creator_id, u.email AS creator_email,
			u.full_name AS creator_name, p.created_at, p.updated_at`).
		Order("p.created_at DESC, p.id ASC").
		Limit(limit).Offset((page - 1) * limit).
		Scan(&rows).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to list projects"})
	}
	return c.JSON(fiber.Map{"data": rows, "total": total, "page": page, "limit": limit})
}
