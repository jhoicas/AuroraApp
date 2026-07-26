package handlers

import (
	"context"
	"errors"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// loadOwnedProject verifica ownership: el proyecto debe pertenecer al tenant del JWT.
func loadOwnedProject(db *gorm.DB, ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error) {
	var project models.Project
	err := db.WithContext(ctx).
		Where("id = ? AND tenant_id = ?", projectID, tenantID).
		First(&project).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

func isNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
