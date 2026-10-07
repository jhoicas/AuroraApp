package dto

// AuditFinding representa un hallazgo estructurado de la auditoría previa MGA.
type AuditFinding struct {
	ID         string `json:"id"`
	Message    string `json:"message"`
	Severity   string `json:"severity"`    // "CRITICAL" | "WARNING" | "SUCCESS"
	SectionKey string `json:"section_key"` // Identificador exacto de pestaña/sección MGA
	IsResolved bool   `json:"is_resolved"`

	Title          string `json:"title"`
	Description    string `json:"description"`
	Recommendation string `json:"recommendation"`
	Section        string `json:"section"`
	TabID          string `json:"tabId"`
	FieldKey       string `json:"fieldKey,omitempty"`
	Level          string `json:"level"` // "error" | "warning" | "suggestion" | "ok"
	TargetURL      string `json:"targetUrl,omitempty"`
}

// FormulationAuditResponse resultado de GET /api/v1/projects/:id/audit.
type FormulationAuditResponse struct {
	OverallScore int            `json:"overallScore"`
	Status       string         `json:"status"` // APROBADO | CON_OBSERVACIONES | REQUIERE_SUBSANACION
	Passed       bool           `json:"passed"`
	Findings     []AuditFinding `json:"findings"`
	Blockers     []string       `json:"blockers"`
	Warnings     []string       `json:"warnings"`
}
