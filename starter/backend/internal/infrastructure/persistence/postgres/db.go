package postgres

import (
	"fmt"
	"log"
	"strings"

	"aurora-backend/internal/domain/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect abre PostgreSQL usando exclusivamente la DATABASE_URL recibida
// (origen: .env / entorno). AutoMigrate usa la misma conexión.
func Connect(databaseURL string) (*gorm.DB, error) {
	databaseURL = strings.TrimSpace(databaseURL)
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required (no default connection string)")
	}

	// PreferSimpleProtocol + PrepareStmt:false son obligatorios con el
	// Transaction Pooler de Supabase (:6543); los prepared statements
	// provocan 42P05 / 42P07 y reinicios en bucle.
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  databaseURL,
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		PrepareStmt: false,
		Logger:      logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}

	reconcileTenantUniqueConstraints(db)

	if err := autoMigrateSafe(db); err != nil {
		return nil, fmt.Errorf("automigrate: %w", err)
	}

	// Garantiza columnas críticas si AutoMigrate no pudo alterar el esquema en Supabase.
	ensureUsersSchema(db)
	ensureProjectsSchema(db)
	ensureSectorsSchema(db)
	ensureProgramasSubprogramasSchema(db)
	ensureCatalogoProductosSchema(db)

	if err := EnsureSystemRoles(db); err != nil {
		return nil, fmt.Errorf("ensure system roles: %w", err)
	}

	log.Println("PostgreSQL connected and migrated via DATABASE_URL")
	return db, nil
}

// reconcileTenantUniqueConstraints evita el crash de AutoMigrate cuando GORM
// ejecuta DROP CONSTRAINT "uni_tenants_domain" y el constraint no existe en Supabase.
func reconcileTenantUniqueConstraints(db *gorm.DB) {
	// Limpia nombres legacy que GORM intenta dropear sin IF EXISTS.
	for _, name := range []string{"uni_tenants_domain", "uni_tenants_nit"} {
		sql := fmt.Sprintf(
			`ALTER TABLE IF EXISTS tenants DROP CONSTRAINT IF EXISTS %s`,
			name,
		)
		if err := db.Exec(sql).Error; err != nil {
			log.Printf("reconcile tenants constraint %s: %v", name, err)
		}
	}

	// Crea (si no existen) índices únicos alineados con el modelo.
	indexes := []string{
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_domain ON tenants (domain)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_nit ON tenants (nit)`,
	}
	for _, sql := range indexes {
		if err := db.Exec(sql).Error; err != nil {
			// Tabla aún no existe en el primer arranque: AutoMigrate la creará.
			if !strings.Contains(strings.ToLower(err.Error()), "does not exist") {
				log.Printf("reconcile tenants index: %v", err)
			}
		}
	}
}

// ensureUsersSchema añade columnas esperadas por el modelo User si faltan en Supabase.
// AutoMigrate a veces no altera tablas ya existentes tras errores 42Pxx ignorados.
func ensureUsersSchema(db *gorm.DB) {
	statements := []string{
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role_id UUID`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
		`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
		`CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id)`,
		`CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id)`,
	}
	execSchemaStatements(db, "ensure users schema", statements)
}

// ensureProjectsSchema garantiza tabla/columnas usadas por GET /api/v1/projects
// (filtros tenant_id + soft delete deleted_at) cuando AutoMigrate no alcanzó a crearlas.
func ensureProjectsSchema(db *gorm.DB) {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS projects (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID,
			creator_id UUID,
			code_bpin VARCHAR(50),
			name TEXT,
			description TEXT,
			sector VARCHAR(255),
			problem_description TEXT,
			general_objective TEXT,
			status VARCHAR(50) DEFAULT 'DRAFT',
			created_at TIMESTAMPTZ,
			updated_at TIMESTAMPTZ,
			deleted_at TIMESTAMPTZ
		)`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS creator_id UUID`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS code_bpin VARCHAR(50)`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS name TEXT`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS sector VARCHAR(255)`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS problem_description TEXT`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS general_objective TEXT`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'DRAFT'`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
		`CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects (tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_projects_creator_id ON projects (creator_id)`,
		`CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects (deleted_at)`,
		`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status)`,
		`CREATE INDEX IF NOT EXISTS idx_projects_sector ON projects (sector)`,
	}
	execSchemaStatements(db, "ensure projects schema", statements)
}

// ensureSectorsSchema garantiza tabla sectores con columnas en español (codigo, nombre, etc.).
func ensureSectorsSchema(db *gorm.DB) {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS sectores (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			codigo VARCHAR(50) NOT NULL,
			nombre VARCHAR(255) NOT NULL,
			aplicacion TEXT,
			observaciones TEXT,
			created_at TIMESTAMPTZ,
			updated_at TIMESTAMPTZ
		)`,
		`ALTER TABLE sectores ADD COLUMN IF NOT EXISTS codigo VARCHAR(50)`,
		`ALTER TABLE sectores ADD COLUMN IF NOT EXISTS nombre VARCHAR(255)`,
		`ALTER TABLE sectores ADD COLUMN IF NOT EXISTS aplicacion TEXT`,
		`ALTER TABLE sectores ADD COLUMN IF NOT EXISTS observaciones TEXT`,
		`ALTER TABLE sectores ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		`ALTER TABLE sectores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_sectores_codigo ON sectores (codigo)`,
		`CREATE INDEX IF NOT EXISTS idx_sectores_nombre ON sectores (nombre)`,
	}
	execSchemaStatements(db, "ensure sectores schema", statements)
}

func ensureProgramasSubprogramasSchema(db *gorm.DB) {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS programas_subprogramas (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID,
			sector_id UUID NOT NULL,
			codigo_sector VARCHAR(50) NOT NULL,
			nombre_sector VARCHAR(255) NOT NULL,
			codigo_programa VARCHAR(50) NOT NULL,
			nombre_programa TEXT NOT NULL,
			ambito_aplicacion TEXT,
			codigo_subprograma VARCHAR(50) NOT NULL,
			nombre_subprograma TEXT NOT NULL,
			observaciones TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`ALTER TABLE programas_subprogramas ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE programas_subprogramas ADD COLUMN IF NOT EXISTS sector_id UUID`,
		`ALTER TABLE programas_subprogramas ADD COLUMN IF NOT EXISTS codigo_sector VARCHAR(50)`,
		`ALTER TABLE programas_subprogramas ADD COLUMN IF NOT EXISTS nombre_sector VARCHAR(255)`,
		`ALTER TABLE programas_subprogramas ADD COLUMN IF NOT EXISTS codigo_programa VARCHAR(50)`,
		`ALTER TABLE programas_subprogramas ADD COLUMN IF NOT EXISTS nombre_programa TEXT`,
		`ALTER TABLE programas_subprogramas ADD COLUMN IF NOT EXISTS ambito_aplicacion TEXT`,
		`ALTER TABLE programas_subprogramas ADD COLUMN IF NOT EXISTS codigo_subprograma VARCHAR(50)`,
		`ALTER TABLE programas_subprogramas ADD COLUMN IF NOT EXISTS nombre_subprograma TEXT`,
		`ALTER TABLE programas_subprogramas ADD COLUMN IF NOT EXISTS observaciones TEXT`,
		`ALTER TABLE programas_subprogramas ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_prog_subprog_codes ON programas_subprogramas (codigo_programa, codigo_subprograma)`,
		`CREATE INDEX IF NOT EXISTS idx_programas_subprogramas_sector_id ON programas_subprogramas (sector_id)`,
	}
	execSchemaStatements(db, "ensure programas_subprogramas schema", statements)
}

func ensureCatalogoProductosSchema(db *gorm.DB) {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS catalogo_productos (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID,
			sector VARCHAR(50),
			nombre_sector VARCHAR(255),
			codigo_programa VARCHAR(50),
			nombre_programa TEXT,
			codigo_producto VARCHAR(50) NOT NULL,
			producto TEXT NOT NULL,
			descripcion TEXT,
			medido_a_traves_de TEXT,
			codigo_indicador_producto VARCHAR(100),
			indicador_producto TEXT,
			unidad_de_medida VARCHAR(255),
			indicador_principal BOOLEAN DEFAULT FALSE,
			es_nacional BOOLEAN DEFAULT FALSE,
			es_territorial BOOLEAN DEFAULT FALSE,
			ods TEXT,
			meta_ods TEXT,
			tipologia_general_suifp TEXT,
			tipologia_d BOOLEAN DEFAULT FALSE,
			tipologia_e BOOLEAN DEFAULT FALSE,
			tipologia_a_piip BOOLEAN DEFAULT FALSE,
			tipologia_b_piip BOOLEAN DEFAULT FALSE,
			tipologia_c_piip BOOLEAN DEFAULT FALSE,
			tiene_edt BOOLEAN DEFAULT FALSE,
			edt TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS sector VARCHAR(50)`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS nombre_sector VARCHAR(255)`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS codigo_programa VARCHAR(50)`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS nombre_programa TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS codigo_producto VARCHAR(50)`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS producto TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS descripcion TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS medido_a_traves_de TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS codigo_indicador_producto VARCHAR(100)`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS indicador_producto TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS unidad_de_medida VARCHAR(255)`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS indicador_principal BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS es_nacional BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS es_territorial BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS ods TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS meta_ods TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS tipologia_general_suifp TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS tipologia_d BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS tipologia_e BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS tipologia_a_piip BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS tipologia_b_piip BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS tipologia_c_piip BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS tiene_edt BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS edt TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		// Convierte tipologías legacy TEXT → BOOLEAN si aplica (idempotente ante fallo).
		`DO $$ BEGIN
			ALTER TABLE catalogo_productos ALTER COLUMN tipologia_d TYPE boolean
			USING (CASE WHEN lower(coalesce(tipologia_d::text,'')) IN ('t','true','1','si','sí','yes','x') THEN true ELSE false END);
		EXCEPTION WHEN others THEN NULL; END $$`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_productos ALTER COLUMN tipologia_e TYPE boolean
			USING (CASE WHEN lower(coalesce(tipologia_e::text,'')) IN ('t','true','1','si','sí','yes','x') THEN true ELSE false END);
		EXCEPTION WHEN others THEN NULL; END $$`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_productos ALTER COLUMN tipologia_a_piip TYPE boolean
			USING (CASE WHEN lower(coalesce(tipologia_a_piip::text,'')) IN ('t','true','1','si','sí','yes','x') THEN true ELSE false END);
		EXCEPTION WHEN others THEN NULL; END $$`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_productos ALTER COLUMN tipologia_b_piip TYPE boolean
			USING (CASE WHEN lower(coalesce(tipologia_b_piip::text,'')) IN ('t','true','1','si','sí','yes','x') THEN true ELSE false END);
		EXCEPTION WHEN others THEN NULL; END $$`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_productos ALTER COLUMN tipologia_c_piip TYPE boolean
			USING (CASE WHEN lower(coalesce(tipologia_c_piip::text,'')) IN ('t','true','1','si','sí','yes','x') THEN true ELSE false END);
		EXCEPTION WHEN others THEN NULL; END $$`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_productos_codigo ON catalogo_productos (codigo_producto)`,
		`CREATE INDEX IF NOT EXISTS idx_catalogo_productos_programa ON catalogo_productos (codigo_programa)`,
	}
	execSchemaStatements(db, "ensure catalogo_productos schema", statements)
}

func execSchemaStatements(db *gorm.DB, label string, statements []string) {
	for _, sql := range statements {
		if err := db.Exec(sql).Error; err != nil {
			msg := strings.ToLower(err.Error())
			if strings.Contains(msg, "does not exist") {
				continue
			}
			log.Printf("%s: %v", label, err)
		}
	}
}

func autoMigrateSafe(db *gorm.DB) error {
	err := db.AutoMigrate(models.AllModels()...)
	if err == nil {
		return nil
	}

	// 42704: constraint/index fantasma; el esquema suele estar ya usable.
	if isMissingConstraintErr(err) {
		log.Printf("automigrate recoverable (missing constraint): %v", err)
		reconcileTenantUniqueConstraints(db)
		err = db.AutoMigrate(models.AllModels()...)
		if err == nil {
			return nil
		}
		if isMissingConstraintErr(err) {
			log.Printf("automigrate warning ignored after retry: %v", err)
			return nil
		}
	}
	return err
}

func isMissingConstraintErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "42704") ||
		strings.Contains(msg, "does not exist") && strings.Contains(msg, "constraint")
}
