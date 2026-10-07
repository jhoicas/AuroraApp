package postgres

import (
	"fmt"
	"log"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
)

// documentTemplatesSchemaSQL es el respaldo (idempotente) si AutoMigrate no creó la tabla.
var documentTemplatesSchemaSQL = []string{
	`CREATE TABLE IF NOT EXISTS document_templates (
		id UUID PRIMARY KEY,
		tenant_id UUID,
		name VARCHAR(255) NOT NULL,
		html_content TEXT NOT NULL,
		is_active BOOLEAN NOT NULL DEFAULT FALSE,
		is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL,
		updated_at TIMESTAMPTZ NOT NULL,
		deleted_at TIMESTAMPTZ
	)`,
	`CREATE INDEX IF NOT EXISTS idx_document_templates_tenant_id ON document_templates (tenant_id)`,
	`CREATE INDEX IF NOT EXISTS idx_document_templates_is_system_default ON document_templates (is_system_default)`,
	`CREATE INDEX IF NOT EXISTS idx_document_templates_deleted_at ON document_templates (deleted_at)`,
}

// EnsureDocumentTemplatesSchema garantiza la tabla document_templates: autoMigrateSafe tolera
// errores recuperables (42704) y puede dejar sin crear los modelos posteriores al fallo
// (SQLSTATE 42P01 al primer uso). Migra el modelo por separado, verifica su existencia y aplica
// DDL de respaldo; devuelve error si sigue ausente (el seed NO debe correr sin la tabla).
func EnsureDocumentTemplatesSchema(db *gorm.DB) error {
	if err := migrateSet(db, []any{&models.DocumentTemplate{}}); err != nil {
		log.Printf("automigrate DocumentTemplate: %v", err)
	}
	if !db.Migrator().HasTable(&models.DocumentTemplate{}) {
		log.Printf("document_templates: AutoMigrate no creó la tabla; aplicando DDL de respaldo")
		execSchemaStatements(db, "ensure document templates schema", documentTemplatesSchemaSQL)
	}
	if !db.Migrator().HasTable(&models.DocumentTemplate{}) {
		return fmt.Errorf(`relation "document_templates" was not created; check DATABASE_URL / DDL permissions`)
	}
	return nil
}
