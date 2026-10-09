package postgres

import (
	"context"
	"errors"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
)

// ErrDnpDuplicate indica que ya existe un verbo o unidad con el mismo nombre.
var ErrDnpDuplicate = errors.New("dnp dictionary entry already exists")

// DnpDictionaryRepository gestiona los diccionarios DNP (verbos y unidades estándar).
type DnpDictionaryRepository struct {
	db *gorm.DB
}

func NewDnpDictionaryRepository(db *gorm.DB) *DnpDictionaryRepository {
	return &DnpDictionaryRepository{db: db}
}

type DnpListParams struct {
	Search   string
	Kind     string // verbos: STRONG | WEAK
	Typology string // unidades
	Page     int
	Limit    int
}

type PaginatedDnpVerbs struct {
	Items    []models.DnpVerb
	Total    int64
	Page     int
	Limit    int
	LastPage int
}

type PaginatedDnpUnits struct {
	Items    []models.DnpStandardUnit
	Total    int64
	Page     int
	Limit    int
	LastPage int
}

func normalizePaging(p *DnpListParams) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.Limit < 1 {
		p.Limit = 20
	}
	if p.Limit > 200 {
		p.Limit = 200
	}
}

func lastPageOf(total int64, limit int) int {
	lp := int((total + int64(limit) - 1) / int64(limit))
	if lp < 1 {
		lp = 1
	}
	return lp
}

// ---------- Verbos ----------

// ListVerbs devuelve todos los verbos ordenados alfabéticamente.
func (r *DnpDictionaryRepository) ListVerbs(ctx context.Context) ([]models.DnpVerb, error) {
	var verbs []models.DnpVerb
	err := r.db.WithContext(ctx).Order("verb ASC").Find(&verbs).Error
	return verbs, err
}

// ListDnpVerbs satisface la interfaz de lectura de la auditoría de formulación.
func (r *DnpDictionaryRepository) ListDnpVerbs(ctx context.Context) ([]models.DnpVerb, error) {
	return r.ListVerbs(ctx)
}

func (r *DnpDictionaryRepository) ListVerbsPaginated(ctx context.Context, p DnpListParams) (*PaginatedDnpVerbs, error) {
	normalizePaging(&p)
	q := r.db.WithContext(ctx).Model(&models.DnpVerb{})
	if s := strings.TrimSpace(p.Search); s != "" {
		q = q.Where("LOWER(verb) LIKE ?", "%"+strings.ToLower(s)+"%")
	}
	if k := strings.ToUpper(strings.TrimSpace(p.Kind)); k != "" {
		q = q.Where("kind = ?", k)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, err
	}
	var items []models.DnpVerb
	if err := q.Order("verb ASC").Offset((p.Page - 1) * p.Limit).Limit(p.Limit).Find(&items).Error; err != nil {
		return nil, err
	}
	return &PaginatedDnpVerbs{Items: items, Total: total, Page: p.Page, Limit: p.Limit, LastPage: lastPageOf(total, p.Limit)}, nil
}

func (r *DnpDictionaryRepository) verbExists(ctx context.Context, verb string, excludeID uint) (bool, error) {
	var count int64
	q := r.db.WithContext(ctx).Model(&models.DnpVerb{}).Where("LOWER(verb) = ?", strings.ToLower(verb))
	if excludeID != 0 {
		q = q.Where("id <> ?", excludeID)
	}
	err := q.Count(&count).Error
	return count > 0, err
}

func (r *DnpDictionaryRepository) CreateVerb(ctx context.Context, v *models.DnpVerb) error {
	v.Verb = models.CanonicalDnpVerb(v.Verb)
	if exists, err := r.verbExists(ctx, v.Verb, 0); err != nil {
		return err
	} else if exists {
		return ErrDnpDuplicate
	}
	now := time.Now().UTC()
	v.CreatedAt, v.UpdatedAt = now, now
	return r.db.WithContext(ctx).Create(v).Error
}

func (r *DnpDictionaryRepository) UpdateVerb(ctx context.Context, v *models.DnpVerb) error {
	v.Verb = models.CanonicalDnpVerb(v.Verb)
	if exists, err := r.verbExists(ctx, v.Verb, v.ID); err != nil {
		return err
	} else if exists {
		return ErrDnpDuplicate
	}
	v.UpdatedAt = time.Now().UTC()
	res := r.db.WithContext(ctx).Model(&models.DnpVerb{}).Where("id = ?", v.ID).Updates(map[string]any{
		"verb": v.Verb, "kind": v.Kind, "notes": v.Notes, "updated_at": v.UpdatedAt,
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return r.db.WithContext(ctx).First(v, v.ID).Error
}

func (r *DnpDictionaryRepository) DeleteVerb(ctx context.Context, id uint) error {
	res := r.db.WithContext(ctx).Delete(&models.DnpVerb{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ---------- Unidades ----------

// ListUnits devuelve las unidades; si onlyActive, excluye las inactivas.
func (r *DnpDictionaryRepository) ListUnits(ctx context.Context, onlyActive bool) ([]models.DnpStandardUnit, error) {
	var units []models.DnpStandardUnit
	q := r.db.WithContext(ctx)
	if onlyActive {
		q = q.Where("active = ?", true)
	}
	err := q.Order("typology ASC, name ASC").Find(&units).Error
	return units, err
}

func (r *DnpDictionaryRepository) ListUnitsPaginated(ctx context.Context, p DnpListParams) (*PaginatedDnpUnits, error) {
	normalizePaging(&p)
	q := r.db.WithContext(ctx).Model(&models.DnpStandardUnit{})
	if s := strings.TrimSpace(p.Search); s != "" {
		like := "%" + strings.ToLower(s) + "%"
		q = q.Where("LOWER(name) LIKE ? OR LOWER(symbol) LIKE ?", like, like)
	}
	if t := strings.ToUpper(strings.TrimSpace(p.Typology)); t != "" {
		q = q.Where("typology = ?", t)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, err
	}
	var items []models.DnpStandardUnit
	if err := q.Order("typology ASC, name ASC").Offset((p.Page - 1) * p.Limit).Limit(p.Limit).Find(&items).Error; err != nil {
		return nil, err
	}
	return &PaginatedDnpUnits{Items: items, Total: total, Page: p.Page, Limit: p.Limit, LastPage: lastPageOf(total, p.Limit)}, nil
}

func (r *DnpDictionaryRepository) unitExists(ctx context.Context, name string, excludeID uint) (bool, error) {
	var count int64
	q := r.db.WithContext(ctx).Model(&models.DnpStandardUnit{}).Where("LOWER(name) = ?", strings.ToLower(name))
	if excludeID != 0 {
		q = q.Where("id <> ?", excludeID)
	}
	err := q.Count(&count).Error
	return count > 0, err
}

func (r *DnpDictionaryRepository) CreateUnit(ctx context.Context, u *models.DnpStandardUnit) error {
	u.Name = strings.TrimSpace(u.Name)
	if exists, err := r.unitExists(ctx, u.Name, 0); err != nil {
		return err
	} else if exists {
		return ErrDnpDuplicate
	}
	now := time.Now().UTC()
	u.CreatedAt, u.UpdatedAt = now, now
	return r.db.WithContext(ctx).Create(u).Error
}

func (r *DnpDictionaryRepository) UpdateUnit(ctx context.Context, u *models.DnpStandardUnit) error {
	u.Name = strings.TrimSpace(u.Name)
	if exists, err := r.unitExists(ctx, u.Name, u.ID); err != nil {
		return err
	} else if exists {
		return ErrDnpDuplicate
	}
	u.UpdatedAt = time.Now().UTC()
	res := r.db.WithContext(ctx).Model(&models.DnpStandardUnit{}).Where("id = ?", u.ID).Updates(map[string]any{
		"name": u.Name, "symbol": u.Symbol, "typology": u.Typology, "active": u.Active, "updated_at": u.UpdatedAt,
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return r.db.WithContext(ctx).First(u, u.ID).Error
}

func (r *DnpDictionaryRepository) DeleteUnit(ctx context.Context, id uint) error {
	res := r.db.WithContext(ctx).Delete(&models.DnpStandardUnit{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func IsDnpNotFound(err error) bool  { return errors.Is(err, gorm.ErrRecordNotFound) }
func IsDnpDuplicate(err error) bool { return errors.Is(err, ErrDnpDuplicate) }
