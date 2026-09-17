package dto

import "aurora-backend/internal/domain/models"

type PaginatedPndResponse struct {
	Data []models.PNDCatalog `json:"data"`
	Meta PaginationMeta      `json:"meta"`
}

type PndImportResponse struct {
	Status   string `json:"status"`
	Message  string `json:"message"`
	Inserted int    `json:"inserted"`
	Skipped  int    `json:"skipped"`
}
