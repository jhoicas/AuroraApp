package dto

import "aurora-backend/internal/domain/models"

type UpsertDnpVerbRequest struct {
	Verb  string `json:"verb" validate:"required,min=2,max=80"`
	Kind  string `json:"kind" validate:"required,oneof=STRONG WEAK"`
	Notes string `json:"notes" validate:"max=1000"`
}

type UpsertDnpUnitRequest struct {
	Name     string `json:"name" validate:"required,min=1,max=120"`
	Symbol   string `json:"symbol" validate:"max=20"`
	Typology string `json:"typology" validate:"required,oneof=SUPERFICIE VOLUMEN TIEMPO LONGITUD ENERGIA MASA CONTEO"`
	Active   *bool  `json:"active"`
}

type PaginatedDnpVerbsResponse struct {
	Data []models.DnpVerb `json:"data"`
	Meta PaginationMeta   `json:"meta"`
}

type PaginatedDnpUnitsResponse struct {
	Data []models.DnpStandardUnit `json:"data"`
	Meta PaginationMeta           `json:"meta"`
}

// DnpDictionaryResponse es la vista de solo lectura para formularios de tenant.
type DnpDictionaryResponse struct {
	StrongVerbs []string                 `json:"strong_verbs"`
	WeakVerbs   []string                 `json:"weak_verbs"`
	Units       []models.DnpStandardUnit `json:"units"`
}
