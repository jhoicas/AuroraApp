package postgres

import (
	"fmt"
	"log"
	"strings"
	"time"

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

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("sql db handle: %w", err)
	}
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetMaxIdleConns(20)
	sqlDB.SetConnMaxLifetime(time.Hour)
	log.Println("PostgreSQL connection pool: maxOpen=100 maxIdle=20 maxLifetime=1h")

	reconcileTenantUniqueConstraints(db)

	if err := autoMigrateSafe(db); err != nil {
		return nil, fmt.Errorf("automigrate: %w", err)
	}

	// Migración explícita del catálogo EDT (por si AllModels se truncó o AutoMigrate
	// abortó antes de llegar a este modelo tras un 42Pxx recuperable).
	if err := db.AutoMigrate(&models.CatalogEdt{}); err != nil {
		log.Printf("automigrate CatalogEdt: %v", err)
	}
	if err := db.AutoMigrate(&models.CatalogDeliverable{}); err != nil {
		log.Printf("automigrate CatalogDeliverable: %v", err)
	}
	if err := db.AutoMigrate(&models.CatalogActivity{}); err != nil {
		log.Printf("automigrate CatalogActivity: %v", err)
	}
	if err := db.AutoMigrate(&models.CatalogOds{}); err != nil {
		log.Printf("automigrate CatalogOds: %v", err)
	}
	if err := db.AutoMigrate(&models.AiKnowledgeNode{}); err != nil {
		log.Printf("automigrate AiKnowledgeNode: %v", err)
	}
	if err := db.AutoMigrate(&models.AiKnowledgeLink{}); err != nil {
		log.Printf("automigrate AiKnowledgeLink: %v", err)
	}
	if err := db.AutoMigrate(&models.AiUsageLog{}); err != nil {
		log.Printf("automigrate AiUsageLog: %v", err)
	}
	if err := db.AutoMigrate(&models.AiChatMessage{}); err != nil {
		log.Printf("automigrate AiChatMessage: %v", err)
	}
	if err := db.AutoMigrate(&models.ProjectEvaluation{}); err != nil {
		log.Printf("automigrate ProjectEvaluation: %v", err)
	}
	if err := db.AutoMigrate(&models.BudgetItem{}); err != nil {
		log.Printf("automigrate BudgetItem: %v", err)
	}
	if err := db.AutoMigrate(&models.MgaCause{}); err != nil {
		log.Printf("automigrate MgaCause: %v", err)
	}
	if err := db.AutoMigrate(&models.MgaSpecificObjective{}); err != nil {
		log.Printf("automigrate MgaSpecificObjective: %v", err)
	}
	if err := db.AutoMigrate(&models.MgaIndicator{}); err != nil {
		log.Printf("automigrate MgaIndicator: %v", err)
	}
	if err := db.AutoMigrate(&models.MgaEffect{}); err != nil {
		log.Printf("automigrate MgaEffect: %v", err)
	}
	if err := db.AutoMigrate(&models.MgaParticipant{}); err != nil {
		log.Printf("automigrate MgaParticipant: %v", err)
	}
	if err := db.AutoMigrate(&models.MgaPopulation{}); err != nil {
		log.Printf("automigrate MgaPopulation: %v", err)
	}
	if err := db.AutoMigrate(&models.MgaAlternative{}); err != nil {
		log.Printf("automigrate MgaAlternative: %v", err)
	}
	if err := db.AutoMigrate(&models.ProjectCatalogLink{}); err != nil {
		log.Printf("automigrate ProjectCatalogLink: %v", err)
	}
	if err := db.AutoMigrate(&models.ProjectEdtNode{}); err != nil {
		log.Printf("automigrate ProjectEdtNode: %v", err)
	}
	if err := db.AutoMigrate(&models.ProjectDeliverable{}); err != nil {
		log.Printf("automigrate ProjectDeliverable: %v", err)
	}
	if err := db.AutoMigrate(&models.ProjectActivity{}); err != nil {
		log.Printf("automigrate ProjectActivity: %v", err)
	}

	// Garantiza columnas críticas si AutoMigrate no pudo alterar el esquema en Supabase.
	ensureUsersSchema(db)
	ensureProjectsSchema(db)
	ensureSectorsSchema(db)
	ensureProgramasSubprogramasSchema(db)
	ensureCatalogoProductosSchema(db)
	ensureCatalogoEdtSchema(db)
	ensureCatalogoEntregablesSchema(db)
	ensureCatalogoActividadesSchema(db)
	ensureCatalogoOdsSchema(db)
	ensureAiKnowledgeSchema(db)
	ensureAiKnowledgeLinksSchema(db)
	ensureAiUsageLogsSchema(db)
	ensureAiChatMessagesSchema(db)
	ensureProjectEvaluationsSchema(db)
	ensureBudgetItemsSchema(db)
	ensureMgaSchema(db)
	ensureMgaExtendedSchema(db)
	ensureProjectEdtSchema(db)

	if !db.Migrator().HasTable(&models.CatalogEdt{}) {
		return nil, fmt.Errorf(`relation "catalogo_edt" was not created; check DATABASE_URL / DDL permissions`)
	}
	if !db.Migrator().HasTable(&models.CatalogDeliverable{}) {
		return nil, fmt.Errorf(`relation "catalogo_entregables" was not created; check DATABASE_URL / DDL permissions`)
	}
	if !db.Migrator().HasTable(&models.CatalogActivity{}) {
		return nil, fmt.Errorf(`relation "catalogo_actividades" was not created; check DATABASE_URL / DDL permissions`)
	}
	if !db.Migrator().HasTable(&models.CatalogOds{}) {
		return nil, fmt.Errorf(`relation "catalogo_ods" was not created; check DATABASE_URL / DDL permissions`)
	}
	if !db.Migrator().HasTable(&models.BudgetItem{}) {
		return nil, fmt.Errorf(`relation "budget_items" was not created; check DATABASE_URL / DDL permissions`)
	}

	if err := EnsureSystemRoles(db); err != nil {
		return nil, fmt.Errorf("ensure system roles: %w", err)
	}

	log.Println("PostgreSQL connected and migrated via DATABASE_URL")
	return db, nil
}

// reconcileTenantUniqueConstraints evita el crash de AutoMigrate cuando GORM
// ejecuta DROP CONSTRAINT "uni_tenants_domain" y el constraint no existe en Supabase.
func reconcileTenantUniqueConstraints(db *gorm.DB) {
	// BD nueva (p. ej. la efímera de E2E): AutoMigrate creará tenants con
	// idx_tenants_domain / idx_tenants_nit desde los tags del modelo.
	if !db.Migrator().HasTable(&models.Tenant{}) {
		return
	}

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
			sector_id UUID,
			program_code VARCHAR(50),
			product_code VARCHAR(50),
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
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS sector_id UUID`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS program_code VARCHAR(50)`,
		`ALTER TABLE projects ADD COLUMN IF NOT EXISTS product_code VARCHAR(50)`,
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
		`CREATE INDEX IF NOT EXISTS idx_projects_sector_id ON projects (sector_id)`,
		`CREATE INDEX IF NOT EXISTS idx_projects_program_code ON projects (program_code)`,
		`CREATE INDEX IF NOT EXISTS idx_projects_product_code ON projects (product_code)`,
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
			nombre_sector TEXT,
			codigo_programa VARCHAR(50),
			nombre_programa TEXT,
			codigo_producto VARCHAR(50) NOT NULL,
			producto TEXT NOT NULL,
			descripcion TEXT,
			medido_a_traves_de TEXT,
			codigo_indicador_producto TEXT NOT NULL DEFAULT '',
			indicador_producto TEXT,
			unidad_de_medida TEXT,
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
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS nombre_sector TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS codigo_programa VARCHAR(50)`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS nombre_programa TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS codigo_producto VARCHAR(50)`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS producto TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS descripcion TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS medido_a_traves_de TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS codigo_indicador_producto TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS indicador_producto TEXT`,
		`ALTER TABLE catalogo_productos ADD COLUMN IF NOT EXISTS unidad_de_medida TEXT`,
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
		// Amplía columnas descriptivas existentes VARCHAR → TEXT (idempotente).
		`ALTER TABLE catalogo_productos ALTER COLUMN nombre_sector TYPE TEXT`,
		`ALTER TABLE catalogo_productos ALTER COLUMN nombre_programa TYPE TEXT`,
		`ALTER TABLE catalogo_productos ALTER COLUMN producto TYPE TEXT`,
		`ALTER TABLE catalogo_productos ALTER COLUMN descripcion TYPE TEXT`,
		`ALTER TABLE catalogo_productos ALTER COLUMN medido_a_traves_de TYPE TEXT`,
		`ALTER TABLE catalogo_productos ALTER COLUMN codigo_indicador_producto TYPE TEXT`,
		`ALTER TABLE catalogo_productos ALTER COLUMN indicador_producto TYPE TEXT`,
		`ALTER TABLE catalogo_productos ALTER COLUMN unidad_de_medida TYPE TEXT`,
		`ALTER TABLE catalogo_productos ALTER COLUMN ods TYPE TEXT`,
		`ALTER TABLE catalogo_productos ALTER COLUMN meta_ods TYPE TEXT`,
		`ALTER TABLE catalogo_productos ALTER COLUMN tipologia_general_suifp TYPE TEXT`,
		`ALTER TABLE catalogo_productos ALTER COLUMN edt TYPE TEXT`,
		// Normaliza NULLs para que la UNIQUE compuesta sea determinista.
		`UPDATE catalogo_productos SET codigo_indicador_producto = '' WHERE codigo_indicador_producto IS NULL`,
		`ALTER TABLE catalogo_productos ALTER COLUMN codigo_indicador_producto SET DEFAULT ''`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_productos ALTER COLUMN codigo_indicador_producto SET NOT NULL;
		EXCEPTION WHEN others THEN NULL; END $$`,
		// Elimina la UNIQUE antigua solo por codigo_producto (si existe).
		`DROP INDEX IF EXISTS idx_catalogo_productos_codigo`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_productos DROP CONSTRAINT IF EXISTS idx_catalogo_productos_codigo;
		EXCEPTION WHEN others THEN NULL; END $$`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_productos DROP CONSTRAINT IF EXISTS catalogo_productos_codigo_producto_key;
		EXCEPTION WHEN others THEN NULL; END $$`,
		// Llave única compuesta: (codigo_producto, codigo_indicador_producto).
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_product_indicador
			ON catalogo_productos (codigo_producto, codigo_indicador_producto)`,
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
		`CREATE INDEX IF NOT EXISTS idx_catalogo_productos_programa ON catalogo_productos (codigo_programa)`,
		`CREATE INDEX IF NOT EXISTS idx_catalogo_productos_codigo_producto ON catalogo_productos (codigo_producto)`,
	}
	execSchemaStatements(db, "ensure catalogo_productos schema", statements)
}

func ensureCatalogoEdtSchema(db *gorm.DB) {
	// Extensión para DEFAULT gen_random_uuid(); si falla (permisos), la tabla
	// se crea igual sin DEFAULT y GORM asigna el UUID en la app.
	if err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`).Error; err != nil {
		log.Printf("ensure catalogo_edt schema: pgcrypto: %v", err)
	}

	createSQL := `CREATE TABLE IF NOT EXISTS catalogo_edt (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID,
			codigo_producto_estandarizado VARCHAR(50) NOT NULL,
			nombre_producto TEXT,
			codigo_entregable_l1 VARCHAR(100),
			nombre_entregable_l1 TEXT,
			codigo_entregable_l2 VARCHAR(100),
			nombre_entregable_l2 TEXT,
			codigo_entregable_l3 VARCHAR(100),
			nombre_entregable_l3 TEXT,
			codigo_actividad VARCHAR(100) NOT NULL DEFAULT '',
			actividad TEXT,
			unidad_de_medida TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
	if err := db.Exec(createSQL).Error; err != nil {
		// Fallback sin DEFAULT de extensión (pooler / permisos restringidos).
		fallback := `CREATE TABLE IF NOT EXISTS catalogo_edt (
			id UUID PRIMARY KEY,
			tenant_id UUID,
			codigo_producto_estandarizado VARCHAR(50) NOT NULL,
			nombre_producto TEXT,
			codigo_entregable_l1 VARCHAR(100),
			nombre_entregable_l1 TEXT,
			codigo_entregable_l2 VARCHAR(100),
			nombre_entregable_l2 TEXT,
			codigo_entregable_l3 VARCHAR(100),
			nombre_entregable_l3 TEXT,
			codigo_actividad VARCHAR(100) NOT NULL DEFAULT '',
			actividad TEXT,
			unidad_de_medida TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
		if err2 := db.Exec(fallback).Error; err2 != nil {
			log.Printf("ensure catalogo_edt schema: CREATE TABLE failed: %v (fallback: %v)", err, err2)
		} else {
			log.Printf("ensure catalogo_edt schema: table created without gen_random_uuid() default")
		}
	}

	statements := []string{
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS codigo_producto_estandarizado VARCHAR(50)`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS nombre_producto TEXT`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS codigo_entregable_l1 VARCHAR(100)`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS nombre_entregable_l1 TEXT`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS codigo_entregable_l2 VARCHAR(100)`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS nombre_entregable_l2 TEXT`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS codigo_entregable_l3 VARCHAR(100)`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS nombre_entregable_l3 TEXT`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS codigo_actividad VARCHAR(100)`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS actividad TEXT`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS unidad_de_medida TEXT`,
		`ALTER TABLE IF EXISTS catalogo_edt ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		`UPDATE catalogo_edt SET codigo_actividad = '' WHERE codigo_actividad IS NULL`,
		`ALTER TABLE IF EXISTS catalogo_edt ALTER COLUMN codigo_actividad SET DEFAULT ''`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_edt ALTER COLUMN codigo_actividad SET NOT NULL;
		EXCEPTION WHEN others THEN NULL; END $$`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_edt ALTER COLUMN nombre_producto TYPE TEXT;
			ALTER TABLE catalogo_edt ALTER COLUMN nombre_entregable_l1 TYPE TEXT;
			ALTER TABLE catalogo_edt ALTER COLUMN nombre_entregable_l2 TYPE TEXT;
			ALTER TABLE catalogo_edt ALTER COLUMN nombre_entregable_l3 TYPE TEXT;
			ALTER TABLE catalogo_edt ALTER COLUMN actividad TYPE TEXT;
			ALTER TABLE catalogo_edt ALTER COLUMN unidad_de_medida TYPE TEXT;
			ALTER TABLE catalogo_edt ALTER COLUMN codigo_producto_estandarizado TYPE VARCHAR(50)
				USING trim(codigo_producto_estandarizado::text);
			ALTER TABLE catalogo_edt ALTER COLUMN codigo_entregable_l1 TYPE VARCHAR(100)
				USING trim(COALESCE(codigo_entregable_l1::text, ''));
			ALTER TABLE catalogo_edt ALTER COLUMN codigo_entregable_l2 TYPE VARCHAR(100)
				USING trim(COALESCE(codigo_entregable_l2::text, ''));
			ALTER TABLE catalogo_edt ALTER COLUMN codigo_entregable_l3 TYPE VARCHAR(100)
				USING trim(COALESCE(codigo_entregable_l3::text, ''));
			ALTER TABLE catalogo_edt ALTER COLUMN codigo_actividad TYPE VARCHAR(100)
				USING trim(COALESCE(codigo_actividad::text, ''));
		EXCEPTION WHEN others THEN NULL; END $$`,
		`DROP INDEX IF EXISTS idx_edt_producto_actividad`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_edt_prod_act
			ON catalogo_edt (codigo_producto_estandarizado, codigo_actividad)`,
		`CREATE INDEX IF NOT EXISTS idx_catalogo_edt_producto
			ON catalogo_edt (codigo_producto_estandarizado)`,
	}
	execSchemaStatements(db, "ensure catalogo_edt schema", statements)

	if db.Migrator().HasTable(&models.CatalogEdt{}) {
		log.Println("ensure catalogo_edt schema: OK (table catalogo_edt ready)")
	} else {
		log.Println("ensure catalogo_edt schema: WARNING — table catalogo_edt still missing")
	}
}

func ensureCatalogoEntregablesSchema(db *gorm.DB) {
	if err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`).Error; err != nil {
		log.Printf("ensure catalogo_entregables schema: pgcrypto: %v", err)
	}

	createSQL := `CREATE TABLE IF NOT EXISTS catalogo_entregables (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID,
			codigo_entregable VARCHAR(50) NOT NULL,
			listado_de_entregables TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
	if err := db.Exec(createSQL).Error; err != nil {
		fallback := `CREATE TABLE IF NOT EXISTS catalogo_entregables (
			id UUID PRIMARY KEY,
			tenant_id UUID,
			codigo_entregable VARCHAR(50) NOT NULL,
			listado_de_entregables TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
		if err2 := db.Exec(fallback).Error; err2 != nil {
			log.Printf("ensure catalogo_entregables schema: CREATE TABLE failed: %v (fallback: %v)", err, err2)
		}
	}

	statements := []string{
		`ALTER TABLE IF EXISTS catalogo_entregables ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE IF EXISTS catalogo_entregables ADD COLUMN IF NOT EXISTS codigo_entregable VARCHAR(50)`,
		`ALTER TABLE IF EXISTS catalogo_entregables ADD COLUMN IF NOT EXISTS listado_de_entregables TEXT`,
		`ALTER TABLE IF EXISTS catalogo_entregables ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_entregables ALTER COLUMN codigo_entregable TYPE VARCHAR(50)
				USING trim(codigo_entregable::text);
			ALTER TABLE catalogo_entregables ALTER COLUMN listado_de_entregables TYPE TEXT;
		EXCEPTION WHEN others THEN NULL; END $$`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_entregable_codigo
			ON catalogo_entregables (codigo_entregable)`,
		`CREATE INDEX IF NOT EXISTS idx_catalogo_entregables_listado
			ON catalogo_entregables (listado_de_entregables)`,
	}
	execSchemaStatements(db, "ensure catalogo_entregables schema", statements)

	if db.Migrator().HasTable(&models.CatalogDeliverable{}) {
		log.Println("ensure catalogo_entregables schema: OK (table catalogo_entregables ready)")
	} else {
		log.Println("ensure catalogo_entregables schema: WARNING — table catalogo_entregables still missing")
	}
}

func ensureCatalogoActividadesSchema(db *gorm.DB) {
	if err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`).Error; err != nil {
		log.Printf("ensure catalogo_actividades schema: pgcrypto: %v", err)
	}

	createSQL := `CREATE TABLE IF NOT EXISTS catalogo_actividades (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID,
			codigo_actividad VARCHAR(50) NOT NULL,
			listado_de_actividades TEXT,
			unidad_de_medida TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
	if err := db.Exec(createSQL).Error; err != nil {
		fallback := `CREATE TABLE IF NOT EXISTS catalogo_actividades (
			id UUID PRIMARY KEY,
			tenant_id UUID,
			codigo_actividad VARCHAR(50) NOT NULL,
			listado_de_actividades TEXT,
			unidad_de_medida TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
		if err2 := db.Exec(fallback).Error; err2 != nil {
			log.Printf("ensure catalogo_actividades schema: CREATE TABLE failed: %v (fallback: %v)", err, err2)
		}
	}

	statements := []string{
		`ALTER TABLE IF EXISTS catalogo_actividades ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE IF EXISTS catalogo_actividades ADD COLUMN IF NOT EXISTS codigo_actividad VARCHAR(50)`,
		`ALTER TABLE IF EXISTS catalogo_actividades ADD COLUMN IF NOT EXISTS listado_de_actividades TEXT`,
		`ALTER TABLE IF EXISTS catalogo_actividades ADD COLUMN IF NOT EXISTS unidad_de_medida TEXT`,
		`ALTER TABLE IF EXISTS catalogo_actividades ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_actividades ALTER COLUMN codigo_actividad TYPE VARCHAR(50)
				USING trim(codigo_actividad::text);
			ALTER TABLE catalogo_actividades ALTER COLUMN listado_de_actividades TYPE TEXT;
			ALTER TABLE catalogo_actividades ALTER COLUMN unidad_de_medida TYPE TEXT;
		EXCEPTION WHEN others THEN NULL; END $$`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_actividad_codigo
			ON catalogo_actividades (codigo_actividad)`,
		`CREATE INDEX IF NOT EXISTS idx_catalogo_actividades_listado
			ON catalogo_actividades (listado_de_actividades)`,
	}
	execSchemaStatements(db, "ensure catalogo_actividades schema", statements)

	if db.Migrator().HasTable(&models.CatalogActivity{}) {
		log.Println("ensure catalogo_actividades schema: OK (table catalogo_actividades ready)")
	} else {
		log.Println("ensure catalogo_actividades schema: WARNING — table catalogo_actividades still missing")
	}
}

func ensureCatalogoOdsSchema(db *gorm.DB) {
	if err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`).Error; err != nil {
		log.Printf("ensure catalogo_ods schema: pgcrypto: %v", err)
	}

	createSQL := `CREATE TABLE IF NOT EXISTS catalogo_ods (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID,
			cod_objetivo_ods VARCHAR(50) NOT NULL,
			descripcion_objetivo_ods TEXT,
			codigo_meta_ods VARCHAR(50) NOT NULL DEFAULT '',
			descripcion_meta_ods TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
	if err := db.Exec(createSQL).Error; err != nil {
		fallback := `CREATE TABLE IF NOT EXISTS catalogo_ods (
			id UUID PRIMARY KEY,
			tenant_id UUID,
			cod_objetivo_ods VARCHAR(50) NOT NULL,
			descripcion_objetivo_ods TEXT,
			codigo_meta_ods VARCHAR(50) NOT NULL DEFAULT '',
			descripcion_meta_ods TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
		if err2 := db.Exec(fallback).Error; err2 != nil {
			log.Printf("ensure catalogo_ods schema: CREATE TABLE failed: %v (fallback: %v)", err, err2)
		}
	}

	statements := []string{
		`ALTER TABLE IF EXISTS catalogo_ods ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE IF EXISTS catalogo_ods ADD COLUMN IF NOT EXISTS cod_objetivo_ods VARCHAR(50)`,
		`ALTER TABLE IF EXISTS catalogo_ods ADD COLUMN IF NOT EXISTS descripcion_objetivo_ods TEXT`,
		`ALTER TABLE IF EXISTS catalogo_ods ADD COLUMN IF NOT EXISTS codigo_meta_ods VARCHAR(50)`,
		`ALTER TABLE IF EXISTS catalogo_ods ADD COLUMN IF NOT EXISTS descripcion_meta_ods TEXT`,
		`ALTER TABLE IF EXISTS catalogo_ods ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		`UPDATE catalogo_ods SET codigo_meta_ods = '' WHERE codigo_meta_ods IS NULL`,
		`ALTER TABLE IF EXISTS catalogo_ods ALTER COLUMN codigo_meta_ods SET DEFAULT ''`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_ods ALTER COLUMN codigo_meta_ods SET NOT NULL;
		EXCEPTION WHEN others THEN NULL; END $$`,
		`DO $$ BEGIN
			ALTER TABLE catalogo_ods ALTER COLUMN cod_objetivo_ods TYPE VARCHAR(50)
				USING trim(cod_objetivo_ods::text);
			ALTER TABLE catalogo_ods ALTER COLUMN codigo_meta_ods TYPE VARCHAR(50)
				USING trim(COALESCE(codigo_meta_ods::text, ''));
			ALTER TABLE catalogo_ods ALTER COLUMN descripcion_objetivo_ods TYPE TEXT;
			ALTER TABLE catalogo_ods ALTER COLUMN descripcion_meta_ods TYPE TEXT;
		EXCEPTION WHEN others THEN NULL; END $$`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_ods_obj_meta
			ON catalogo_ods (cod_objetivo_ods, codigo_meta_ods)`,
		`CREATE INDEX IF NOT EXISTS idx_catalogo_ods_objetivo
			ON catalogo_ods (cod_objetivo_ods)`,
	}
	execSchemaStatements(db, "ensure catalogo_ods schema", statements)

	if db.Migrator().HasTable(&models.CatalogOds{}) {
		log.Println("ensure catalogo_ods schema: OK (table catalogo_ods ready)")
	} else {
		log.Println("ensure catalogo_ods schema: WARNING — table catalogo_ods still missing")
	}
}

func ensureAiKnowledgeSchema(db *gorm.DB) {
	if err := db.Exec(`CREATE EXTENSION IF NOT EXISTS vector`).Error; err != nil {
		log.Printf("ensure ai_knowledge schema: vector extension: %v", err)
	}
	if err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`).Error; err != nil {
		log.Printf("ensure ai_knowledge schema: pgcrypto: %v", err)
	}

	createSQL := `CREATE TABLE IF NOT EXISTS ai_knowledge_nodes (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID,
			project_key VARCHAR(255) NOT NULL,
			node_type VARCHAR(80) NOT NULL,
			label VARCHAR(500),
			content TEXT NOT NULL,
			metadata JSONB DEFAULT '{}',
			embedding vector(384),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
	if err := db.Exec(createSQL).Error; err != nil {
		fallback := `CREATE TABLE IF NOT EXISTS ai_knowledge_nodes (
			id UUID PRIMARY KEY,
			tenant_id UUID,
			project_key VARCHAR(255) NOT NULL,
			node_type VARCHAR(80) NOT NULL,
			label VARCHAR(500),
			content TEXT NOT NULL,
			metadata JSONB DEFAULT '{}',
			embedding vector(384),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
		if err2 := db.Exec(fallback).Error; err2 != nil {
			log.Printf("ensure ai_knowledge schema: CREATE TABLE failed: %v (fallback: %v)", err, err2)
		}
	}

	statements := []string{
		`ALTER TABLE IF EXISTS ai_knowledge_nodes ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE IF EXISTS ai_knowledge_nodes ADD COLUMN IF NOT EXISTS project_key VARCHAR(255)`,
		`ALTER TABLE IF EXISTS ai_knowledge_nodes ADD COLUMN IF NOT EXISTS node_type VARCHAR(80)`,
		`ALTER TABLE IF EXISTS ai_knowledge_nodes ADD COLUMN IF NOT EXISTS label VARCHAR(500)`,
		`ALTER TABLE IF EXISTS ai_knowledge_nodes ADD COLUMN IF NOT EXISTS content TEXT`,
		`ALTER TABLE IF EXISTS ai_knowledge_nodes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`,
		`ALTER TABLE IF EXISTS ai_knowledge_nodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		`DO $$ BEGIN
			ALTER TABLE ai_knowledge_nodes DROP COLUMN IF EXISTS embedding;
		EXCEPTION WHEN others THEN NULL; END $$`,
		`ALTER TABLE IF EXISTS ai_knowledge_nodes ADD COLUMN IF NOT EXISTS embedding vector(384)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_knowledge_nodes_tenant_id ON ai_knowledge_nodes (tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_knowledge_project_key ON ai_knowledge_nodes (project_key)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_knowledge_node_type ON ai_knowledge_nodes (node_type)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_knowledge_created_at ON ai_knowledge_nodes (created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_knowledge_embedding_hnsw
			ON ai_knowledge_nodes USING hnsw (embedding vector_cosine_ops)`,
	}
	execSchemaStatements(db, "ensure ai_knowledge schema", statements)

	if db.Migrator().HasTable(&models.AiKnowledgeNode{}) {
		log.Println("ensure ai_knowledge schema: OK (table ai_knowledge_nodes ready)")
	} else {
		log.Println("ensure ai_knowledge schema: WARNING — table ai_knowledge_nodes still missing")
	}
}

func ensureAiKnowledgeLinksSchema(db *gorm.DB) {
	createSQL := `CREATE TABLE IF NOT EXISTS ai_knowledge_links (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID,
			project_key VARCHAR(255) NOT NULL,
			source_node_id UUID NOT NULL,
			target_node_id UUID NOT NULL,
			relationship VARCHAR(80) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
	if err := db.Exec(createSQL).Error; err != nil {
		fallback := `CREATE TABLE IF NOT EXISTS ai_knowledge_links (
			id UUID PRIMARY KEY,
			tenant_id UUID,
			project_key VARCHAR(255) NOT NULL,
			source_node_id UUID NOT NULL,
			target_node_id UUID NOT NULL,
			relationship VARCHAR(80) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
		if err2 := db.Exec(fallback).Error; err2 != nil {
			log.Printf("ensure ai_knowledge_links schema: CREATE TABLE failed: %v (fallback: %v)", err, err2)
		}
	}

	statements := []string{
		`ALTER TABLE IF EXISTS ai_knowledge_links ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE IF EXISTS ai_knowledge_links ADD COLUMN IF NOT EXISTS project_key VARCHAR(255)`,
		`ALTER TABLE IF EXISTS ai_knowledge_links ADD COLUMN IF NOT EXISTS source_node_id UUID`,
		`ALTER TABLE IF EXISTS ai_knowledge_links ADD COLUMN IF NOT EXISTS target_node_id UUID`,
		`ALTER TABLE IF EXISTS ai_knowledge_links ADD COLUMN IF NOT EXISTS relationship VARCHAR(80)`,
		`ALTER TABLE IF EXISTS ai_knowledge_links ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		`CREATE INDEX IF NOT EXISTS idx_ai_knowledge_links_tenant_id ON ai_knowledge_links (tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_knowledge_links_project ON ai_knowledge_links (project_key)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_knowledge_links_source ON ai_knowledge_links (source_node_id)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_knowledge_links_target ON ai_knowledge_links (target_node_id)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_knowledge_links_rel ON ai_knowledge_links (relationship)`,
	}
	execSchemaStatements(db, "ensure ai_knowledge_links schema", statements)
}

func ensureAiUsageLogsSchema(db *gorm.DB) {
	createSQL := `CREATE TABLE IF NOT EXISTS ai_usage_logs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL,
			role VARCHAR(50) NOT NULL,
			action VARCHAR(80) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
	if err := db.Exec(createSQL).Error; err != nil {
		fallback := `CREATE TABLE IF NOT EXISTS ai_usage_logs (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL,
			role VARCHAR(50) NOT NULL,
			action VARCHAR(80) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
		if err2 := db.Exec(fallback).Error; err2 != nil {
			log.Printf("ensure ai_usage_logs schema: CREATE TABLE failed: %v (fallback: %v)", err, err2)
		}
	}

	statements := []string{
		`ALTER TABLE IF EXISTS ai_usage_logs ADD COLUMN IF NOT EXISTS user_id UUID`,
		`ALTER TABLE IF EXISTS ai_usage_logs ADD COLUMN IF NOT EXISTS role VARCHAR(50)`,
		`ALTER TABLE IF EXISTS ai_usage_logs ADD COLUMN IF NOT EXISTS action VARCHAR(80)`,
		`ALTER TABLE IF EXISTS ai_usage_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
		`CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON ai_usage_logs (user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_role ON ai_usage_logs (role)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_action ON ai_usage_logs (action)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs (created_at)`,
	}
	execSchemaStatements(db, "ensure ai_usage_logs schema", statements)
}

func ensureAiChatMessagesSchema(db *gorm.DB) {
	createSQL := `CREATE TABLE IF NOT EXISTS ai_chat_messages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL,
			tenant_id UUID,
			session_id VARCHAR(64) NOT NULL,
			role VARCHAR(20) NOT NULL,
			content TEXT NOT NULL,
			model VARCHAR(100),
			action_cards JSONB DEFAULT '[]',
			route_context VARCHAR(500),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
	if err := db.Exec(createSQL).Error; err != nil {
		log.Printf("ensure ai_chat_messages schema: %v", err)
	}
	statements := []string{
		`CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user ON ai_chat_messages (user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages (session_id)`,
		`CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created ON ai_chat_messages (created_at DESC)`,
	}
	execSchemaStatements(db, "ensure ai_chat_messages schema", statements)
}

func ensureProjectEvaluationsSchema(db *gorm.DB) {
	createSQL := `CREATE TABLE IF NOT EXISTS project_evaluations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			project_id UUID NOT NULL,
			tenant_id UUID NOT NULL,
			alternative_name VARCHAR(255) NOT NULL,
			discount_rate DOUBLE PRECISION NOT NULL,
			cash_flows JSONB NOT NULL,
			vpn DOUBLE PRECISION NOT NULL,
			tir DOUBLE PRECISION,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`
	if err := db.Exec(createSQL).Error; err != nil {
		log.Printf("ensure project_evaluations schema: %v", err)
	}
	statements := []string{
		`CREATE INDEX IF NOT EXISTS idx_project_evaluations_project ON project_evaluations (project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_project_evaluations_tenant ON project_evaluations (tenant_id)`,
	}
	execSchemaStatements(db, "ensure project_evaluations schema", statements)
}

func ensureBudgetItemsSchema(db *gorm.DB) {
	createSQL := `CREATE TABLE IF NOT EXISTS budget_items (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			product_id UUID,
			description TEXT NOT NULL,
			amount NUMERIC(18,2) NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createSQL).Error; err != nil {
		log.Printf("ensure budget_items schema: %v", err)
	}

	statements := []string{
		`CREATE INDEX IF NOT EXISTS idx_budget_items_tenant ON budget_items (tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_budget_items_project ON budget_items (project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_budget_items_product ON budget_items (product_id)`,
		`CREATE INDEX IF NOT EXISTS idx_budget_items_deleted_at ON budget_items (deleted_at)`,
		`ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS project_id UUID`,
		`ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS product_id UUID`,
		`ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS description TEXT`,
		`ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS amount NUMERIC(18,2)`,
		`ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
	}
	execSchemaStatements(db, "ensure budget_items schema", statements)
}

func ensureMgaSchema(db *gorm.DB) {
	createCausesSQL := `CREATE TABLE IF NOT EXISTS mga_causes (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			parent_id UUID,
			cause_type VARCHAR(50) NOT NULL,
			description TEXT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createCausesSQL).Error; err != nil {
		log.Printf("ensure mga_causes schema: %v", err)
	}

	createObjectivesSQL := `CREATE TABLE IF NOT EXISTS mga_specific_objectives (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			cause_id UUID NOT NULL,
			description TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createObjectivesSQL).Error; err != nil {
		log.Printf("ensure mga_specific_objectives schema: %v", err)
	}

	createIndicatorsSQL := `CREATE TABLE IF NOT EXISTS mga_indicators (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			specific_objective_id UUID,
			name TEXT NOT NULL,
			unit VARCHAR(255) NOT NULL,
			target NUMERIC(18,2) NOT NULL,
			source_type VARCHAR(100) NOT NULL,
			verification_source TEXT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createIndicatorsSQL).Error; err != nil {
		log.Printf("ensure mga_indicators schema: %v", err)
	}

	statements := []string{
		`CREATE INDEX IF NOT EXISTS idx_mga_causes_tenant ON mga_causes (tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_causes_project ON mga_causes (project_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_mga_specific_objectives_cause ON mga_specific_objectives (cause_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_specific_objectives_tenant ON mga_specific_objectives (tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_indicators_project ON mga_indicators (project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_indicators_tenant ON mga_indicators (tenant_id)`,
	}
	execSchemaStatements(db, "ensure mga schema", statements)
}

func ensureMgaExtendedSchema(db *gorm.DB) {
	createEffectsSQL := `CREATE TABLE IF NOT EXISTS mga_effects (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			parent_id UUID,
			effect_type VARCHAR(50) NOT NULL,
			description TEXT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createEffectsSQL).Error; err != nil {
		log.Printf("ensure mga_effects schema: %v", err)
	}

	createParticipantsSQL := `CREATE TABLE IF NOT EXISTS mga_participants (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			actor TEXT NOT NULL,
			entity TEXT NOT NULL,
			position VARCHAR(100) NOT NULL,
			interests TEXT NOT NULL,
			contribution TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createParticipantsSQL).Error; err != nil {
		log.Printf("ensure mga_participants schema: %v", err)
	}

	createPopulationsSQL := `CREATE TABLE IF NOT EXISTS mga_populations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			population_type VARCHAR(50) NOT NULL,
			total_number INTEGER NOT NULL DEFAULT 0,
			source TEXT NOT NULL,
			locations JSONB NOT NULL DEFAULT '[]',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createPopulationsSQL).Error; err != nil {
		log.Printf("ensure mga_populations schema: %v", err)
	}

	createAlternativesSQL := `CREATE TABLE IF NOT EXISTS mga_alternatives (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			description TEXT NOT NULL,
			evaluate_profitability BOOLEAN NOT NULL DEFAULT FALSE,
			evaluate_cost BOOLEAN NOT NULL DEFAULT FALSE,
			proceeds_to_preparation BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createAlternativesSQL).Error; err != nil {
		log.Printf("ensure mga_alternatives schema: %v", err)
	}

	statements := []string{
		`CREATE INDEX IF NOT EXISTS idx_mga_effects_tenant_project ON mga_effects (tenant_id, project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_effects_parent ON mga_effects (parent_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_effects_deleted_at ON mga_effects (deleted_at)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_participants_tenant_project ON mga_participants (tenant_id, project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_participants_deleted_at ON mga_participants (deleted_at)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_populations_tenant_project ON mga_populations (tenant_id, project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_populations_deleted_at ON mga_populations (deleted_at)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_alternatives_tenant_project ON mga_alternatives (tenant_id, project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mga_alternatives_deleted_at ON mga_alternatives (deleted_at)`,
		`ALTER TABLE mga_effects ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE mga_effects ADD COLUMN IF NOT EXISTS project_id UUID`,
		`ALTER TABLE mga_effects ADD COLUMN IF NOT EXISTS parent_id UUID`,
		`ALTER TABLE mga_effects ADD COLUMN IF NOT EXISTS effect_type VARCHAR(50)`,
		`ALTER TABLE mga_effects ADD COLUMN IF NOT EXISTS description TEXT`,
		`ALTER TABLE mga_effects ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`,
		`ALTER TABLE mga_effects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE mga_effects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE mga_effects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
		`ALTER TABLE mga_participants ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE mga_participants ADD COLUMN IF NOT EXISTS project_id UUID`,
		`ALTER TABLE mga_participants ADD COLUMN IF NOT EXISTS actor TEXT`,
		`ALTER TABLE mga_participants ADD COLUMN IF NOT EXISTS entity TEXT`,
		`ALTER TABLE mga_participants ADD COLUMN IF NOT EXISTS position VARCHAR(100)`,
		`ALTER TABLE mga_participants ADD COLUMN IF NOT EXISTS interests TEXT`,
		`ALTER TABLE mga_participants ADD COLUMN IF NOT EXISTS contribution TEXT`,
		`ALTER TABLE mga_participants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE mga_participants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE mga_participants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
		`ALTER TABLE mga_populations ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE mga_populations ADD COLUMN IF NOT EXISTS project_id UUID`,
		`ALTER TABLE mga_populations ADD COLUMN IF NOT EXISTS population_type VARCHAR(50)`,
		`ALTER TABLE mga_populations ADD COLUMN IF NOT EXISTS total_number INTEGER DEFAULT 0`,
		`ALTER TABLE mga_populations ADD COLUMN IF NOT EXISTS source TEXT`,
		`ALTER TABLE mga_populations ADD COLUMN IF NOT EXISTS locations JSONB DEFAULT '[]'`,
		`ALTER TABLE mga_populations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE mga_populations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE mga_populations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
		`ALTER TABLE mga_alternatives ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE mga_alternatives ADD COLUMN IF NOT EXISTS project_id UUID`,
		`ALTER TABLE mga_alternatives ADD COLUMN IF NOT EXISTS description TEXT`,
		`ALTER TABLE mga_alternatives ADD COLUMN IF NOT EXISTS evaluate_profitability BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE mga_alternatives ADD COLUMN IF NOT EXISTS evaluate_cost BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE mga_alternatives ADD COLUMN IF NOT EXISTS proceeds_to_preparation BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE mga_alternatives ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE mga_alternatives ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE mga_alternatives ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
	}
	execSchemaStatements(db, "ensure mga extended schema", statements)
}

func ensureProjectEdtSchema(db *gorm.DB) {
	if err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto`).Error; err != nil {
		log.Printf("ensure project edt schema: pgcrypto: %v", err)
	}

	createCatalogLinksSQL := `CREATE TABLE IF NOT EXISTS project_catalog_links (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			product_id UUID NOT NULL,
			product_code VARCHAR(50) NOT NULL,
			tipologia VARCHAR(10) NOT NULL DEFAULT '',
			requires_edt BOOLEAN NOT NULL DEFAULT FALSE,
			sector_code VARCHAR(50) NOT NULL DEFAULT '',
			program_code VARCHAR(50) NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createCatalogLinksSQL).Error; err != nil {
		log.Printf("ensure project_catalog_links schema: %v", err)
	}

	createEdtNodesSQL := `CREATE TABLE IF NOT EXISTS project_edt_nodes (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			catalog_edt_id UUID,
			code VARCHAR(100) NOT NULL,
			level INTEGER NOT NULL DEFAULT 1,
			name TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createEdtNodesSQL).Error; err != nil {
		log.Printf("ensure project_edt_nodes schema: %v", err)
	}

	createDeliverablesSQL := `CREATE TABLE IF NOT EXISTS project_deliverables (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			project_edt_node_id UUID NOT NULL,
			catalog_deliverable_id UUID,
			code VARCHAR(100) NOT NULL,
			name TEXT NOT NULL,
			amount NUMERIC(18,2) NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createDeliverablesSQL).Error; err != nil {
		log.Printf("ensure project_deliverables schema: %v", err)
	}

	createActivitiesSQL := `CREATE TABLE IF NOT EXISTS project_activities (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			project_id UUID NOT NULL,
			project_deliverable_id UUID NOT NULL,
			catalog_activity_id UUID,
			code VARCHAR(100) NOT NULL,
			name TEXT NOT NULL,
			quantity NUMERIC(18,4) NOT NULL DEFAULT 0,
			unit_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
			total_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			deleted_at TIMESTAMPTZ
		)`
	if err := db.Exec(createActivitiesSQL).Error; err != nil {
		log.Printf("ensure project_activities schema: %v", err)
	}

	statements := []string{
		`CREATE INDEX IF NOT EXISTS idx_project_catalog_links_tenant_project ON project_catalog_links (tenant_id, project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_project_catalog_links_deleted_at ON project_catalog_links (deleted_at)`,
		`CREATE INDEX IF NOT EXISTS idx_project_edt_nodes_tenant_project ON project_edt_nodes (tenant_id, project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_project_edt_nodes_deleted_at ON project_edt_nodes (deleted_at)`,
		`CREATE INDEX IF NOT EXISTS idx_project_edt_nodes_catalog_edt ON project_edt_nodes (catalog_edt_id)`,
		`CREATE INDEX IF NOT EXISTS idx_project_deliverables_tenant_project ON project_deliverables (tenant_id, project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_project_deliverables_edt_node ON project_deliverables (project_edt_node_id)`,
		`CREATE INDEX IF NOT EXISTS idx_project_deliverables_deleted_at ON project_deliverables (deleted_at)`,
		`CREATE INDEX IF NOT EXISTS idx_project_activities_tenant_project ON project_activities (tenant_id, project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_project_activities_deliverable ON project_activities (project_deliverable_id)`,
		`CREATE INDEX IF NOT EXISTS idx_project_activities_deleted_at ON project_activities (deleted_at)`,
		`ALTER TABLE project_catalog_links ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE project_catalog_links ADD COLUMN IF NOT EXISTS project_id UUID`,
		`ALTER TABLE project_catalog_links ADD COLUMN IF NOT EXISTS product_id UUID`,
		`ALTER TABLE project_catalog_links ADD COLUMN IF NOT EXISTS product_code VARCHAR(50)`,
		`ALTER TABLE project_catalog_links ADD COLUMN IF NOT EXISTS tipologia VARCHAR(10) DEFAULT ''`,
		`ALTER TABLE project_catalog_links ADD COLUMN IF NOT EXISTS requires_edt BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE project_catalog_links ADD COLUMN IF NOT EXISTS sector_code VARCHAR(50) DEFAULT ''`,
		`ALTER TABLE project_catalog_links ADD COLUMN IF NOT EXISTS program_code VARCHAR(50) DEFAULT ''`,
		`ALTER TABLE project_catalog_links ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE project_catalog_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE project_catalog_links ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
		`ALTER TABLE project_edt_nodes ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE project_edt_nodes ADD COLUMN IF NOT EXISTS project_id UUID`,
		`ALTER TABLE project_edt_nodes ADD COLUMN IF NOT EXISTS catalog_edt_id UUID`,
		`ALTER TABLE project_edt_nodes ADD COLUMN IF NOT EXISTS code VARCHAR(100)`,
		`ALTER TABLE project_edt_nodes ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1`,
		`ALTER TABLE project_edt_nodes ADD COLUMN IF NOT EXISTS name TEXT`,
		`ALTER TABLE project_edt_nodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE project_edt_nodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE project_edt_nodes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
		`ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS project_id UUID`,
		`ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS project_edt_node_id UUID`,
		`ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS catalog_deliverable_id UUID`,
		`ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS code VARCHAR(100)`,
		`ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS name TEXT`,
		`ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS amount NUMERIC(18,2) DEFAULT 0`,
		`ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE project_deliverables ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS tenant_id UUID`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS project_id UUID`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS project_deliverable_id UUID`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS catalog_activity_id UUID`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS code VARCHAR(100)`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS name TEXT`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS quantity NUMERIC(18,4) DEFAULT 0`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(18,2) DEFAULT 0`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS total_cost NUMERIC(18,2) DEFAULT 0`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE project_activities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
	}
	execSchemaStatements(db, "ensure project edt schema", statements)
}

func execSchemaStatements(db *gorm.DB, label string, statements []string) {
	for _, sql := range statements {
		if err := db.Exec(sql).Error; err != nil {
			msg := strings.ToLower(err.Error())
			// Solo ignorar "relation/table does not exist" en ALTER/UPDATE de
			// arranque; NUNCA silenciar "function ... does not exist" ni fallos
			// de CREATE TABLE / CREATE INDEX.
			isMissingRelation := (strings.Contains(msg, "relation") || strings.Contains(msg, "table")) &&
				strings.Contains(msg, "does not exist")
			isCreate := strings.Contains(strings.ToUpper(strings.TrimSpace(sql)), "CREATE ")
			if isMissingRelation && !isCreate {
				continue
			}
			log.Printf("%s: %v", label, err)
		}
	}
}

func autoMigrateSafe(db *gorm.DB) error {
	// roles y tenants primero: users, projects y el resto declaran FKs hacia ellos.
	if err := migrateSet(db, []any{&models.Role{}, &models.Tenant{}}); err != nil {
		return err
	}
	return migrateSet(db, models.AllModels())
}

// migrateSet ejecuta AutoMigrate tolerando 42704 (constraint/índice fantasma).
func migrateSet(db *gorm.DB, dst []any) error {
	err := db.AutoMigrate(dst...)
	if err == nil {
		return nil
	}

	// 42704: constraint/index fantasma; el esquema suele estar ya usable.
	if isMissingConstraintErr(err) {
		log.Printf("automigrate recoverable (missing constraint): %v", err)
		reconcileTenantUniqueConstraints(db)
		err = db.AutoMigrate(dst...)
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
