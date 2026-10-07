package postgres

import (
	"context"
	"errors"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	// ErrTemplateNotFound: la plantilla no existe o no es visible para el tenant.
	ErrTemplateNotFound = errors.New("document template not found")
	// ErrTemplateReadOnly: las plantillas globales del sistema no se editan.
	ErrTemplateReadOnly = errors.New("system document template is read-only")
)

// DocumentTemplateRepository gestiona plantillas del Documento Técnico por tenant.
type DocumentTemplateRepository struct {
	db *gorm.DB
}

func NewDocumentTemplateRepository(db *gorm.DB) *DocumentTemplateRepository {
	return &DocumentTemplateRepository{db: db}
}

// visible: plantillas del tenant o globales del sistema.
func visibleTemplates(tx *gorm.DB, tenantID uuid.UUID) *gorm.DB {
	return tx.Where("tenant_id = ? OR (tenant_id IS NULL AND is_system_default = ?)", tenantID, true)
}

// List devuelve (sin html_content) las plantillas del tenant más las globales.
func (r *DocumentTemplateRepository) List(ctx context.Context, tenantID uuid.UUID) ([]models.DocumentTemplate, error) {
	var out []models.DocumentTemplate
	err := visibleTemplates(r.db.WithContext(ctx), tenantID).
		Select("id", "tenant_id", "name", "is_active", "is_system_default", "created_at", "updated_at").
		Order("is_system_default DESC, created_at ASC, name ASC").
		Find(&out).Error
	return out, err
}

func (r *DocumentTemplateRepository) get(tx *gorm.DB, tenantID, id uuid.UUID) (*models.DocumentTemplate, error) {
	var t models.DocumentTemplate
	if err := visibleTemplates(tx, tenantID).Where("id = ?", id).First(&t).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTemplateNotFound
		}
		return nil, err
	}
	return &t, nil
}

// Get devuelve una plantilla completa visible para el tenant.
func (r *DocumentTemplateRepository) Get(ctx context.Context, tenantID, id uuid.UUID) (*models.DocumentTemplate, error) {
	return r.get(r.db.WithContext(ctx), tenantID, id)
}

// Create crea una plantilla del tenant. Si cloneFrom no es nil, copia su HTML (propia o global).
// Si html está vacío y no hay clon, usa un documento mínimo.
func (r *DocumentTemplateRepository) Create(ctx context.Context, tenantID uuid.UUID, name, html string, cloneFrom *uuid.UUID) (*models.DocumentTemplate, error) {
	if cloneFrom != nil {
		src, err := r.Get(ctx, tenantID, *cloneFrom)
		if err != nil {
			return nil, err
		}
		if html == "" {
			html = src.HTMLContent
		}
	}
	if html == "" {
		html = "<h1>Documento Técnico</h1><p></p>"
	}
	t := &models.DocumentTemplate{TenantID: &tenantID, Name: name, HTMLContent: html}
	if err := r.db.WithContext(ctx).Create(t).Error; err != nil {
		return nil, err
	}
	return t, nil
}

// Update modifica nombre y/o HTML de una plantilla propia (autoguardado).
func (r *DocumentTemplateRepository) Update(ctx context.Context, tenantID, id uuid.UUID, name, html *string) (*models.DocumentTemplate, error) {
	t, err := r.Get(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if t.TenantID == nil {
		return nil, ErrTemplateReadOnly
	}
	updates := map[string]any{}
	if name != nil {
		updates["name"] = *name
		t.Name = *name
	}
	if html != nil {
		updates["html_content"] = *html
		t.HTMLContent = *html
	}
	if len(updates) > 0 {
		if err := r.db.WithContext(ctx).Model(&models.DocumentTemplate{}).
			Where("id = ? AND tenant_id = ?", id, tenantID).Updates(updates).Error; err != nil {
			return nil, err
		}
	}
	return t, nil
}

// Activate marca la plantilla como activa y desactiva todas las demás del tenant (una transacción).
// Activar una plantilla global la clona primero al tenant (la fila global nunca cambia).
func (r *DocumentTemplateRepository) Activate(ctx context.Context, tenantID, id uuid.UUID) (*models.DocumentTemplate, error) {
	var result *models.DocumentTemplate
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		t, err := r.get(tx, tenantID, id)
		if err != nil {
			return err
		}
		if t.TenantID == nil {
			clone := &models.DocumentTemplate{TenantID: &tenantID, Name: t.Name, HTMLContent: t.HTMLContent}
			if err := tx.Create(clone).Error; err != nil {
				return err
			}
			t = clone
		}
		if err := tx.Model(&models.DocumentTemplate{}).
			Where("tenant_id = ? AND id <> ?", tenantID, t.ID).
			Update("is_active", false).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.DocumentTemplate{}).
			Where("id = ? AND tenant_id = ?", t.ID, tenantID).
			Update("is_active", true).Error; err != nil {
			return err
		}
		t.IsActive = true
		result = t
		return nil
	})
	return result, err
}

// Delete elimina (soft delete) una plantilla propia del tenant. Las globales del sistema
// (tenant_id nulo o is_system_default) devuelven ErrTemplateReadOnly.
func (r *DocumentTemplateRepository) Delete(ctx context.Context, tenantID, id uuid.UUID) error {
	t, err := r.Get(ctx, tenantID, id)
	if err != nil {
		return err
	}
	if t.TenantID == nil || t.IsSystemDefault {
		return ErrTemplateReadOnly
	}
	return r.db.WithContext(ctx).Where("id = ? AND tenant_id = ?", id, tenantID).
		Delete(&models.DocumentTemplate{}).Error
}

// Resolve elige la plantilla para generar el PDF: activa del tenant, o la global por defecto.
// Devuelve ErrTemplateNotFound si no existe ninguna.
func (r *DocumentTemplateRepository) Resolve(ctx context.Context, tenantID uuid.UUID) (*models.DocumentTemplate, error) {
	var t models.DocumentTemplate
	err := r.db.WithContext(ctx).Where("tenant_id = ? AND is_active = ?", tenantID, true).
		Order("updated_at DESC").First(&t).Error
	if err == nil {
		return &t, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	err = r.db.WithContext(ctx).Where("is_system_default = ? AND tenant_id IS NULL", true).
		Order("created_at ASC, name ASC").First(&t).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrTemplateNotFound
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}
