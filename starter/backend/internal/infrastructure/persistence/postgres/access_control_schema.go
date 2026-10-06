package postgres

import (
	"fmt"
	"log"

	"aurora-backend/internal/domain/models"

	"gorm.io/gorm"
)

// accessControlModels son las tablas PBAC (ADR-0001) en orden de dependencia.
// Se migran de forma explícita y se verifican: autoMigrateSafe tolera errores
// recuperables (42704) y puede dejar sin crear los modelos que siguen al fallo.
func accessControlModels() []any {
	return []any{
		&models.Module{},
		&models.TenantModule{},
		&models.RoleModuleDefault{},
		&models.UserModulePermission{},
		&models.AccessAuditLog{},
	}
}

// accessControlSchemaSQL es el respaldo (idempotente) si AutoMigrate no creó las tablas.
var accessControlSchemaSQL = []string{
	`CREATE TABLE IF NOT EXISTS modules (
		id UUID PRIMARY KEY,
		code VARCHAR(100) NOT NULL,
		name VARCHAR(150) NOT NULL,
		description TEXT,
		kind VARCHAR(20) NOT NULL DEFAULT 'MODULE',
		scope VARCHAR(20) NOT NULL DEFAULT 'TENANT',
		parent_id UUID REFERENCES modules(id) ON UPDATE CASCADE ON DELETE RESTRICT,
		route VARCHAR(255) NOT NULL,
		sort_order INTEGER NOT NULL DEFAULT 0,
		is_active BOOLEAN NOT NULL DEFAULT TRUE,
		seed_version INTEGER NOT NULL DEFAULT 0,
		created_at TIMESTAMPTZ NOT NULL,
		updated_at TIMESTAMPTZ NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_modules_code ON modules (code)`,
	`CREATE INDEX IF NOT EXISTS idx_modules_parent_id ON modules (parent_id)`,

	`CREATE TABLE IF NOT EXISTS tenant_modules (
		id UUID PRIMARY KEY,
		tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
		module_id UUID NOT NULL REFERENCES modules(id) ON UPDATE CASCADE ON DELETE CASCADE,
		is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
		created_at TIMESTAMPTZ NOT NULL,
		updated_at TIMESTAMPTZ NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_modules_tenant_module ON tenant_modules (tenant_id, module_id)`,
	`CREATE INDEX IF NOT EXISTS idx_tenant_modules_module_id ON tenant_modules (module_id)`,

	`CREATE TABLE IF NOT EXISTS role_module_defaults (
		id UUID PRIMARY KEY,
		role_id UUID NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE,
		module_id UUID NOT NULL REFERENCES modules(id) ON UPDATE CASCADE ON DELETE CASCADE,
		can_view BOOLEAN NOT NULL DEFAULT FALSE,
		can_create BOOLEAN NOT NULL DEFAULT FALSE,
		can_edit BOOLEAN NOT NULL DEFAULT FALSE,
		can_delete BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL,
		updated_at TIMESTAMPTZ NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_role_module_defaults_role_module ON role_module_defaults (role_id, module_id)`,
	`CREATE INDEX IF NOT EXISTS idx_role_module_defaults_module_id ON role_module_defaults (module_id)`,

	`CREATE TABLE IF NOT EXISTS user_module_permissions (
		id UUID PRIMARY KEY,
		user_id UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
		module_id UUID NOT NULL REFERENCES modules(id) ON UPDATE CASCADE ON DELETE CASCADE,
		can_view BOOLEAN NOT NULL DEFAULT FALSE,
		can_create BOOLEAN NOT NULL DEFAULT FALSE,
		can_edit BOOLEAN NOT NULL DEFAULT FALSE,
		can_delete BOOLEAN NOT NULL DEFAULT FALSE,
		granted_by UUID,
		created_at TIMESTAMPTZ NOT NULL,
		updated_at TIMESTAMPTZ NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_module_permissions_user_module ON user_module_permissions (user_id, module_id)`,
	`CREATE INDEX IF NOT EXISTS idx_user_module_permissions_module_id ON user_module_permissions (module_id)`,

	`CREATE TABLE IF NOT EXISTS access_audit_logs (
		id UUID PRIMARY KEY,
		tenant_id UUID,
		actor_user_id UUID,
		target_user_id UUID,
		module_id UUID,
		action VARCHAR(60) NOT NULL,
		details JSONB NOT NULL DEFAULT '{}',
		created_at TIMESTAMPTZ NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS idx_access_audit_logs_tenant_id ON access_audit_logs (tenant_id)`,
	`CREATE INDEX IF NOT EXISTS idx_access_audit_logs_actor_user_id ON access_audit_logs (actor_user_id)`,
	`CREATE INDEX IF NOT EXISTS idx_access_audit_logs_target_user_id ON access_audit_logs (target_user_id)`,
	`CREATE INDEX IF NOT EXISTS idx_access_audit_logs_action ON access_audit_logs (action)`,
	`CREATE INDEX IF NOT EXISTS idx_access_audit_logs_created_at ON access_audit_logs (created_at)`,
}

// EnsureAccessControlSchema migra las tablas PBAC una por una y garantiza que
// existan (con DDL de respaldo si AutoMigrate no las creó). Devuelve error si
// alguna tabla sigue faltando: el seed NO debe correr sin ellas.
func EnsureAccessControlSchema(db *gorm.DB) error {
	for _, m := range accessControlModels() {
		if err := migrateSet(db, []any{m}); err != nil {
			log.Printf("automigrate PBAC %T: %v", m, err)
		}
	}

	if missing := missingAccessControlTables(db); len(missing) > 0 {
		log.Printf("PBAC: AutoMigrate no creó %v; aplicando DDL de respaldo", missing)
		execSchemaStatements(db, "ensure access control schema", accessControlSchemaSQL)
	}

	if missing := missingAccessControlTables(db); len(missing) > 0 {
		return fmt.Errorf("tablas PBAC ausentes tras la migración: %v", missing)
	}
	return nil
}

func missingAccessControlTables(db *gorm.DB) []string {
	var missing []string
	for _, m := range accessControlModels() {
		if !db.Migrator().HasTable(m) {
			stmt := &gorm.Statement{DB: db}
			_ = stmt.Parse(m)
			missing = append(missing, stmt.Schema.Table)
		}
	}
	return missing
}
