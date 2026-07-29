package handlers

import (
	"errors"
	"net/mail"
	"strings"
	"time"

	"aurora-backend/internal/domain/constants"
	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/interfaces/http/dto"
	httpmw "aurora-backend/internal/interfaces/http/middleware"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db        *gorm.DB
	jwtSecret string
}

func NewAuthHandler(db *gorm.DB, jwtSecret string) *AuthHandler {
	return &AuthHandler{db: db, jwtSecret: jwtSecret}
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req dto.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var user models.User
	if err := h.db.WithContext(c.Context()).
		Preload("Role").
		Where("email = ? AND is_active = ?", req.Email, true).
		First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "credenciales inválidas"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to authenticate"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "credenciales inválidas"})
	}

	claims := httpmw.Claims{
		UserID:    user.ID.String(),
		Role:      strings.ToUpper(strings.TrimSpace(user.Role.Code)),
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
			Subject:   user.ID.String(),
		},
	}
	if user.TenantID != nil {
		tid := user.TenantID.String()
		claims.TenantID = &tid
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to issue token"})
	}

	refreshClaims := claims
	refreshClaims.TokenType = "refresh"
	refreshClaims.RegisteredClaims = jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(7 * 24 * time.Hour)),
		IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
		Subject:   user.ID.String(),
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshSigned, err := refreshToken.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to issue refresh token"})
	}

	var tenantID *string
	if user.TenantID != nil {
		s := user.TenantID.String()
		tenantID = &s
	}

	return c.JSON(dto.LoginResponse{
		Token:        signed,
		RefreshToken: refreshSigned,
		User: dto.LoginUserResponse{
			ID:       user.ID.String(),
			Email:    user.Email,
			FullName: user.FullName,
			Role:     strings.ToUpper(strings.TrimSpace(user.Role.Code)),
			TenantID: tenantID,
		},
	})
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req dto.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}

	req.EntityName = strings.TrimSpace(req.EntityName)
	req.NIT = strings.TrimSpace(req.NIT)
	req.FullName = strings.TrimSpace(req.FullName)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	// Solo formato RFC de email; cualquier dominio (gmail, outlook, gov, etc.).
	if _, err := mail.ParseAddress(req.Email); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "correo electrónico inválido"})
	}

	ctx := c.Context()
	db := h.db.WithContext(ctx)

	var existingCount int64
	if err := db.Unscoped().
		Model(&models.User{}).
		Where("email = ?", req.Email).
		Count(&existingCount).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "no se pudo verificar disponibilidad del correo",
		})
	}
	if existingCount > 0 {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "el correo ya está registrado"})
	}

	var role models.Role
	if err := db.Where("code = ?", constants.RoleTenantAdmin).First(&role).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "rol TENANT_ADMIN no configurado; ejecute el seed de roles",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load role"})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to hash password"})
	}

	now := time.Now().UTC()
	nit := req.NIT
	tenant := models.Tenant{
		ID:           uuid.New(),
		Name:         req.EntityName,
		NIT:          &nit,
		ContactEmail: req.Email,
		Status:       constants.TenantStatusActive,
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	tenantID := tenant.ID
	user := models.User{
		ID:           uuid.New(),
		TenantID:     &tenantID,
		RoleID:       role.ID,
		Email:        req.Email,
		PasswordHash: string(hash),
		FullName:     req.FullName,
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&tenant).Error; err != nil {
			return err
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		if isUniqueViolation(err) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error": "ya existe una entidad con ese NIT o el correo ya está en uso",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to register institution"})
	}

	return c.Status(fiber.StatusCreated).JSON(dto.RegisterResponse{
		Message:  "Institución registrada correctamente. Ya puede iniciar sesión.",
		TenantID: tenant.ID.String(),
		Email:    user.Email,
	})
}

func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var req dto.RefreshTokenRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	req.RefreshToken = strings.TrimSpace(req.RefreshToken)
	if err := dto.Validate(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	claims, err := httpmw.ParseRefreshClaims(h.jwtSecret, req.RefreshToken)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid refresh token"})
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid refresh token"})
	}

	var user models.User
	if err := h.db.WithContext(c.Context()).Preload("Role").Where("id = ? AND is_active = ?", userID, true).First(&user).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "user not found"})
	}

	accessClaims := httpmw.Claims{
		UserID:    user.ID.String(),
		Role:      strings.ToUpper(strings.TrimSpace(user.Role.Code)),
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
			Subject:   user.ID.String(),
		},
	}
	if user.TenantID != nil {
		tid := user.TenantID.String()
		accessClaims.TenantID = &tid
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	signed, err := accessToken.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to issue token"})
	}

	refreshClaims := accessClaims
	refreshClaims.TokenType = "refresh"
	refreshClaims.RegisteredClaims = jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().UTC().Add(7 * 24 * time.Hour)),
		IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
		Subject:   user.ID.String(),
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshSigned, err := refreshToken.SignedString([]byte(h.jwtSecret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to issue refresh token"})
	}

	return c.JSON(dto.RefreshTokenResponse{
		Token:        signed,
		RefreshToken: refreshSigned,
	})
}
