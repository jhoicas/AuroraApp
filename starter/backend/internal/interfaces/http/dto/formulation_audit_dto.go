package dto

// FormulationAuditResponse resultado de GET /api/v1/projects/:id/audit.
type FormulationAuditResponse struct {
	Passed   bool     `json:"passed"`
	Blockers []string `json:"blockers"`
	Warnings []string `json:"warnings"`
}
