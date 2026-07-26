package main

import (
	"errors"
	"log"
	"strings"
	"time"

	"aurora-backend/internal/config"
	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func main() {
	cfg := config.LoadConfig()

	db, err := postgres.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	// Connect ya ejecuta EnsureSystemRoles; se vuelve a llamar por claridad del seed.
	if err := postgres.EnsureSystemRoles(db); err != nil {
		log.Fatalf("seed roles: %v", err)
	}

	role, err := findRoleByCode(db, constants.RoleSuperAdmin)
	if err != nil {
		log.Fatalf("role %s: %v", constants.RoleSuperAdmin, err)
	}

	// Confirma el mismo code que usa auth/register.
	if _, err := findRoleByCode(db, constants.RoleTenantAdmin); err != nil {
		log.Fatalf("role %s: %v — requerido por POST /api/v1/auth/register", constants.RoleTenantAdmin, err)
	}

	email := strings.ToLower(strings.TrimSpace("admin@aurora.gov.co"))
	password := "Admin2026*"

	var existing models.User
	err = db.Where("email = ?", email).First(&existing).Error
	if err == nil {
		log.Printf("usuario ya existe: %s (id=%s) — no se modifica", email, existing.ID)
		log.Printf("roles OK: %s, %s", constants.RoleSuperAdmin, constants.RoleTenantAdmin)
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Fatalf("buscar usuario: %v", err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("bcrypt: %v", err)
	}

	now := time.Now().UTC()
	user := models.User{
		ID:           uuid.New(),
		TenantID:     nil, // SUPER_ADMIN es global
		RoleID:       role.ID,
		Email:        email,
		PasswordHash: string(hash),
		FullName:     "Super Admin",
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := db.Create(&user).Error; err != nil {
		log.Fatalf("crear usuario: %v", err)
	}

	log.Printf("usuario seed OK: %s | rol=%s | id=%s", user.Email, constants.RoleSuperAdmin, user.ID)
	log.Printf("roles OK: %s, %s", constants.RoleSuperAdmin, constants.RoleTenantAdmin)
}

func findRoleByCode(db *gorm.DB, code string) (models.Role, error) {
	var role models.Role
	err := db.Where("code = ?", code).First(&role).Error
	return role, err
}
