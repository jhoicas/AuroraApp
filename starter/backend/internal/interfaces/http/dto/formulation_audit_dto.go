package dto

// AuditFinding representa un hallazgo estructurado de la auditoría previa MGA.
type AuditFinding struct {
	ID         string `json:"id"`
	Message    string `json:"message"`
	Severity   string `json:"severity"`    // "CRITICAL" | "WARNING" | "SUCCESS"
	SectionKey string `json:"section_key"` // Identificador exacto de pestaña/sección MGA
	IsResolved bool   `json:"is_resolved"`
}

// FormulationAuditResponse resultado de GET /api/v1/projects/:id/audit.
type FormulationAuditResponse struct {
	Passed   bool           `json:"passed"`
	Findings []AuditFinding `json:"findings"`
	Blockers []string       `json:"blockers"`
	Warnings []string       `json:"warnings"`
}
