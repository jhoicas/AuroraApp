package dto

import "aurora-backend/internal/domain/models"

type CreateMeasurementUnitRequest struct {
	ID   int    `json:"id"`
	Name string `json:"name" validate:"required,min=1,max=255"`
}

type UpdateMeasurementUnitRequest struct {
	Name string `json:"name" validate:"required,min=1,max=255"`
}

type MeasurementUnitResponse struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type PaginatedMeasurementUnitsResponse struct {
	Data []models.MeasurementUnit `json:"data"`
	Meta PaginationMeta           `json:"meta"`
}
