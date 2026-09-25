package dto

// InvestmentPipelineKPIs métricas clave de alto nivel del pipeline de inversión.
type InvestmentPipelineKPIs struct {
	TotalBudget         float64 `json:"total_budget"`
	TotalProjects       int64   `json:"total_projects"`
	AverageProjectCost  float64 `json:"average_project_cost"`
	ViableProjectsCount int64   `json:"viable_projects_count"`
}

// StatusFunnelStage etapa del embudo de estado del ciclo de proyectos.
type StatusFunnelStage struct {
	Status      string  `json:"status"`
	Label       string  `json:"label"`
	Count       int64   `json:"count"`
	TotalBudget float64 `json:"total_budget"`
}

// SectorDistributionItem distribución presupuestal agrupada por sector DNP.
type SectorDistributionItem struct {
	SectorCode   string  `json:"sector_code"`
	SectorName   string  `json:"sector_name"`
	ProjectCount int64   `json:"project_count"`
	TotalBudget  float64 `json:"total_budget"`
	Percentage   float64 `json:"percentage"`
}

// InvestmentPipelineReportResponse respuesta estructurada del reporte gerencial de pipeline.
type InvestmentPipelineReportResponse struct {
	KPIs               InvestmentPipelineKPIs   `json:"kpis"`
	StatusFunnel       []StatusFunnelStage      `json:"status_funnel"`
	SectorDistribution []SectorDistributionItem `json:"sector_distribution"`
}

// AuditRadarIssue error o cuello de botella detectado en la formulación de proyectos.
type AuditRadarIssue struct {
	Issue      string  `json:"issue"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

// AuditRadarReportResponse diagnóstico de calidad y radar de auditoría MGA para el Banco de Proyectos.
type AuditRadarReportResponse struct {
	TotalAudited    int64             `json:"total_audited"`
	ReadyProjects   int64             `json:"ready_projects"`
	BlockedProjects int64             `json:"blocked_projects"`
	TopErrors       []AuditRadarIssue `json:"top_errors"`
}

