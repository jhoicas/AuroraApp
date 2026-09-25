package postgres

import (
	"context"
	"math"
	"sort"
	"strings"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/interfaces/http/dto"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProjectProgressSQL es la expresión SQL optimizada para calcular el porcentaje de avance (0-100)
// evaluando los 10 hitos MGA requeridos:
// 1. Datos Básicos: name != '' AND sector_id IS NOT NULL
// 2. Problema Central: problem_description != '' AND situacion_existente != ''
// 3. Causas: al menos 1 registro en mga_causes
// 4. Efectos: al menos 1 registro en mga_effects
// 5. Participantes: al menos 1 registro en mga_participants
// 6. Población: al menos 1 registro en mga_populations
// 7. Objetivo General: general_objective != ''
// 8. Alternativas: al menos 1 registro en mga_alternatives
// 9. Cadena de Valor: al menos 1 registro en project_deliverables o project_activities
// 10. Presupuesto: al menos 1 registro en budget_items
// Fórmula: (hitos_cumplidos * 100) / 10 = hitos_cumplidos * 10
const ProjectProgressSQL = `(
	(CASE WHEN projects.name IS NOT NULL AND TRIM(projects.name) != '' AND projects.sector_id IS NOT NULL THEN 1 ELSE 0 END) +
	(CASE WHEN projects.problem_description IS NOT NULL AND TRIM(projects.problem_description) != '' AND projects.situacion_existente IS NOT NULL AND TRIM(projects.situacion_existente) != '' THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM mga_causes WHERE mga_causes.project_id = projects.id AND mga_causes.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM mga_effects WHERE mga_effects.project_id = projects.id AND mga_effects.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM mga_participants WHERE mga_participants.project_id = projects.id AND mga_participants.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM mga_populations WHERE mga_populations.project_id = projects.id AND mga_populations.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN projects.general_objective IS NOT NULL AND TRIM(projects.general_objective) != '' THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM mga_alternatives WHERE mga_alternatives.project_id = projects.id AND mga_alternatives.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM project_deliverables WHERE project_deliverables.project_id = projects.id AND project_deliverables.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM project_activities WHERE project_activities.project_id = projects.id AND project_activities.deleted_at IS NULL) THEN 1 ELSE 0 END) +
	(CASE WHEN EXISTS (SELECT 1 FROM budget_items WHERE budget_items.project_id = projects.id AND budget_items.deleted_at IS NULL) THEN 1 ELSE 0 END)
) * 10`

// ProjectWithProgress contiene el modelo de proyecto y su avance calculado.
type ProjectWithProgress struct {
	models.Project
	Progress int `gorm:"column:progress"`
}

// ProjectRepository acceso a proyectos con aislamiento multi-tenant obligatorio.
type ProjectRepository struct {
	db *gorm.DB
}

func NewProjectRepository(db *gorm.DB) *ProjectRepository {
	return &ProjectRepository{db: db}
}

// FindOwned devuelve el proyecto solo si pertenece al tenant indicado.
func (r *ProjectRepository) FindOwned(ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error) {
	var project models.Project
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ?", projectID, tenantID).
		First(&project).Error
	if err != nil {
		return nil, err
	}
	return &project, nil
}

// FindOwnedWithProgress devuelve el proyecto junto con su porcentaje de avance calculado.
func (r *ProjectRepository) FindOwnedWithProgress(ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error) {
	project, err := r.FindOwned(ctx, projectID, tenantID)
	if err != nil {
		return nil, err
	}
	progress, err := r.CalculateProgress(ctx, projectID)
	if err == nil {
		project.Progress = progress
	}
	return project, nil
}

// UpdateProjectDetails persiste los campos de formulación MGA del proyecto.
func (r *ProjectRepository) UpdateProjectDetails(ctx context.Context, project *models.Project) error {
	return r.db.WithContext(ctx).
		Model(project).
		Select(
			"ProblemDescription",
			"GeneralObjective",
			"SituacionExistente",
			"MagnitudProblema",
			"UpdatedAt",
		).
		Updates(project).Error
}

// CalculateProgress calcula el avance (0-100) para un proyecto específico en BD.
func (r *ProjectRepository) CalculateProgress(ctx context.Context, projectID uuid.UUID) (int, error) {
	var progress int
	err := r.db.WithContext(ctx).
		Table("projects").
		Select(ProjectProgressSQL).
		Where("id = ?", projectID).
		Scan(&progress).Error
	if err != nil {
		return 0, err
	}
	return progress, nil
}

// CalculateProgressForProjects calcula el avance para una lista de IDs de proyectos en una sola consulta optimizada (evitando problema N+1).
func (r *ProjectRepository) CalculateProgressForProjects(ctx context.Context, projectIDs []uuid.UUID) (map[uuid.UUID]int, error) {
	if len(projectIDs) == 0 {
		return make(map[uuid.UUID]int), nil
	}

	type progressResult struct {
		ID       uuid.UUID `gorm:"column:id"`
		Progress int       `gorm:"column:progress"`
	}

	var results []progressResult
	err := r.db.WithContext(ctx).
		Table("projects").
		Select("id, (" + ProjectProgressSQL + ") AS progress").
		Where("id IN ?", projectIDs).
		Scan(&results).Error
	if err != nil {
		return nil, err
	}

	progressMap := make(map[uuid.UUID]int, len(results))
	for _, res := range results {
		progressMap[res.ID] = res.Progress
	}
	return progressMap, nil
}

// ListOwnedWithProgress devuelve proyectos paginados con avance calculado en una sola consulta.
func (r *ProjectRepository) ListOwnedWithProgress(ctx context.Context, tenantID uuid.UUID, limit, offset int) ([]ProjectWithProgress, int64, error) {
	var total int64
	base := r.db.WithContext(ctx).Model(&models.Project{}).Where("tenant_id = ?", tenantID)
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var results []ProjectWithProgress
	err := r.db.WithContext(ctx).
		Table("projects").
		Select("projects.*, ("+ProjectProgressSQL+") AS progress").
		Where("projects.tenant_id = ? AND projects.deleted_at IS NULL", tenantID).
		Order("projects.created_at DESC").
		Limit(limit).
		Offset(offset).
		Scan(&results).Error
	if err != nil {
		return nil, 0, err
	}
	return results, total, nil
}

// GetInvestmentPipelineReport calcula el informe gerencial del pipeline de inversión y distribución sectorial.
func (r *ProjectRepository) GetInvestmentPipelineReport(ctx context.Context, tenantID uuid.UUID) (*dto.InvestmentPipelineReportResponse, error) {
	var projects []models.Project
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Find(&projects).Error
	if err != nil {
		return nil, err
	}

	orderedStages := []struct {
		Status string
		Label  string
	}{
		{Status: "IDEATION", Label: "Ideación"},
		{Status: "FORMULATION", Label: "Formulación"},
		{Status: "AUDIT", Label: "Auditoría"},
		{Status: "VIABLE", Label: "Viabilidad"},
		{Status: "APPROVED", Label: "Aprobado"},
	}

	funnelMap := make(map[string]*dto.StatusFunnelStage)
	for _, stage := range orderedStages {
		funnelMap[stage.Status] = &dto.StatusFunnelStage{
			Status:      stage.Status,
			Label:       stage.Label,
			Count:       0,
			TotalBudget: 0,
		}
	}

	if len(projects) == 0 {
		funnel := make([]dto.StatusFunnelStage, 0, len(orderedStages))
		for _, stage := range orderedStages {
			funnel = append(funnel, *funnelMap[stage.Status])
		}
		return &dto.InvestmentPipelineReportResponse{
			KPIs: dto.InvestmentPipelineKPIs{
				TotalBudget:         0,
				TotalProjects:       0,
				AverageProjectCost:  0,
				ViableProjectsCount: 0,
			},
			StatusFunnel:       funnel,
			SectorDistribution: []dto.SectorDistributionItem{},
		}, nil
	}

	// 1. Obtener costos acumulados por proyecto de project_activities (EDT)
	type projectSum struct {
		ProjectID uuid.UUID `gorm:"column:project_id"`
		Total     float64   `gorm:"column:total"`
	}
	var edtSums []projectSum
	_ = r.db.WithContext(ctx).Table("project_activities").
		Select("project_id, COALESCE(SUM(total_cost), 0) as total").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Group("project_id").
		Scan(&edtSums).Error

	edtCostMap := make(map[uuid.UUID]float64, len(edtSums))
	for _, s := range edtSums {
		edtCostMap[s.ProjectID] = s.Total
	}

	// 2. Obtener costos acumulados por proyecto de budget_items
	var budgetSums []projectSum
	_ = r.db.WithContext(ctx).Table("budget_items").
		Select("project_id, COALESCE(SUM(amount), 0) as total").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Group("project_id").
		Scan(&budgetSums).Error

	budgetCostMap := make(map[uuid.UUID]float64, len(budgetSums))
	for _, s := range budgetSums {
		budgetCostMap[s.ProjectID] = s.Total
	}

	// 3. Resolver nombres y códigos de sectores desde la tabla sectores
	var sectorIDs []uuid.UUID
	for _, p := range projects {
		if p.SectorID != nil && *p.SectorID != uuid.Nil {
			sectorIDs = append(sectorIDs, *p.SectorID)
		}
	}
	sectorMap := make(map[uuid.UUID]models.Sector)
	if len(sectorIDs) > 0 {
		var sectors []models.Sector
		if err := r.db.WithContext(ctx).Where("id IN ?", sectorIDs).Find(&sectors).Error; err == nil {
			for _, sec := range sectors {
				sectorMap[sec.ID] = sec
			}
		}
	}

	type sectorAgg struct {
		Code        string
		Name        string
		Count       int64
		TotalBudget float64
	}
	sectorAggMap := make(map[string]*sectorAgg)

	var totalBudget float64
	var viableCount int64

	for _, p := range projects {
		// Presupuesto del proyecto: prioriza EDT si existe, o budget_items
		edtCost := edtCostMap[p.ID]
		bCost := budgetCostMap[p.ID]
		cost := edtCost
		if bCost > cost {
			cost = bCost
		}

		totalBudget += cost

		// Funnel stage
		stageKey := mapProjectStatusToFunnel(p.Status)
		if f, ok := funnelMap[stageKey]; ok {
			f.Count++
			f.TotalBudget += cost
		}

		// Viable / listo: Estados viabilizados o aprobados
		statusUpper := strings.ToUpper(strings.TrimSpace(p.Status))
		if statusUpper == "APPROVED" || statusUpper == "VIABLE" || statusUpper == "READY" || statusUpper == "SUBMITTED" {
			viableCount++
		}

		// Sector DNP
		var secCode, secName string
		if p.SectorID != nil {
			if s, ok := sectorMap[*p.SectorID]; ok {
				secCode = strings.TrimSpace(s.Code)
				secName = strings.TrimSpace(s.Name)
			}
		}
		if secName == "" && strings.TrimSpace(p.Sector) != "" {
			secName = strings.TrimSpace(p.Sector)
		}
		if secName == "" {
			secName = "Sin Sector Asignado"
			secCode = "SIN_SECTOR"
		}

		aggKey := secName
		if _, exists := sectorAggMap[aggKey]; !exists {
			sectorAggMap[aggKey] = &sectorAgg{
				Code: secCode,
				Name: secName,
			}
		}
		sectorAggMap[aggKey].Count++
		sectorAggMap[aggKey].TotalBudget += cost
	}

	// 4. Preparar embudo ordenado
	funnel := make([]dto.StatusFunnelStage, 0, len(orderedStages))
	for _, stage := range orderedStages {
		f := funnelMap[stage.Status]
		f.TotalBudget = math.Round(f.TotalBudget*100) / 100
		funnel = append(funnel, *f)
	}

	// 5. Preparar distribución sectorial ordenada
	distribution := make([]dto.SectorDistributionItem, 0, len(sectorAggMap))
	for _, agg := range sectorAggMap {
		pct := 0.0
		if totalBudget > 0 {
			pct = math.Round((agg.TotalBudget/totalBudget)*10000) / 100
		}
		distribution = append(distribution, dto.SectorDistributionItem{
			SectorCode:   agg.Code,
			SectorName:   agg.Name,
			ProjectCount: agg.Count,
			TotalBudget:  math.Round(agg.TotalBudget*100) / 100,
			Percentage:   pct,
		})
	}

	sort.Slice(distribution, func(i, j int) bool {
		if distribution[i].TotalBudget == distribution[j].TotalBudget {
			return distribution[i].ProjectCount > distribution[j].ProjectCount
		}
		return distribution[i].TotalBudget > distribution[j].TotalBudget
	})

	totalProjects := int64(len(projects))
	avgCost := 0.0
	if totalProjects > 0 {
		avgCost = math.Round((totalBudget/float64(totalProjects))*100) / 100
	}

	return &dto.InvestmentPipelineReportResponse{
		KPIs: dto.InvestmentPipelineKPIs{
			TotalBudget:         math.Round(totalBudget*100) / 100,
			TotalProjects:       totalProjects,
			AverageProjectCost:  avgCost,
			ViableProjectsCount: viableCount,
		},
		StatusFunnel:       funnel,
		SectorDistribution: distribution,
	}, nil
}

func mapProjectStatusToFunnel(status string) string {
	s := strings.ToUpper(strings.TrimSpace(status))
	switch s {
	case "DRAFT", "BORRADOR", "IDEATION", "IDEACION", "IDEA", "PERFIL":
		return "IDEATION"
	case "IN_FORMULATION", "FORMULATION", "FORMULATING", "FORMULACION", "IN_PROGRESS", "EN_PROCESO", "PREFACTIBILIDAD", "FACTIBILIDAD":
		return "FORMULATION"
	case "SUBMITTED", "AUDIT", "AUDITING", "AUDITORIA", "IN_REVIEW", "EN_REVISION", "EVALUATING":
		return "AUDIT"
	case "VIABLE", "VIABILIZADO", "VIABILITY", "READY", "LISTO":
		return "VIABLE"
	case "APPROVED", "APROBADO", "FINISHED", "FINALIZADO":
		return "APPROVED"
	default:
		return "IDEATION"
	}
}

// GetAuditRadarReport genera el diagnóstico de calidad y radar de auditoría MGA para el Banco de Proyectos.
func (r *ProjectRepository) GetAuditRadarReport(ctx context.Context, tenantID uuid.UUID) (*dto.AuditRadarReportResponse, error) {
	var projects []models.Project
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND deleted_at IS NULL AND UPPER(TRIM(status)) NOT IN ('APPROVED', 'APROBADO', 'VIABLE', 'VIABILIZADO', 'READY', 'FINALIZADO')", tenantID).
		Find(&projects).Error
	if err != nil {
		return nil, err
	}

	totalAudited := int64(len(projects))
	if totalAudited == 0 {
		return &dto.AuditRadarReportResponse{
			TotalAudited:    0,
			ReadyProjects:   0,
			BlockedProjects: 0,
			TopErrors:       []dto.AuditRadarIssue{},
		}, nil
	}

	// Consultar costos de actividades por proyecto para evaluar la cadena de valor
	type projectActivitySum struct {
		ProjectID uuid.UUID `gorm:"column:project_id"`
		TotalCost float64   `gorm:"column:total_cost"`
	}
	var actSums []projectActivitySum
	_ = r.db.WithContext(ctx).Table("project_activities").
		Select("project_id, COALESCE(SUM(total_cost), 0) as total_cost").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Group("project_id").
		Scan(&actSums).Error

	activityCostMap := make(map[uuid.UUID]float64, len(actSums))
	for _, a := range actSums {
		activityCostMap[a.ProjectID] = a.TotalCost
	}

	var countProblem int64
	var countObjective int64
	var countSituacion int64
	var countMagnitud int64
	var countCadenaValor int64

	var readyProjects int64
	var blockedProjects int64

	for _, p := range projects {
		isBlocked := false

		// 1. Falta descripción del problema central
		if len(strings.TrimSpace(p.ProblemDescription)) == 0 {
			countProblem++
			isBlocked = true
		}

		// 2. Falta objetivo general
		if len(strings.TrimSpace(p.GeneralObjective)) == 0 {
			countObjective++
			isBlocked = true
		}

		// 3. Situación existente incompleta (< 100 caracteres)
		if len(strings.TrimSpace(p.SituacionExistente)) < 100 {
			countSituacion++
			isBlocked = true
		}

		// 4. Magnitud del problema sin justificar (< 100 caracteres)
		if len(strings.TrimSpace(p.MagnitudProblema)) < 100 {
			countMagnitud++
			isBlocked = true
		}

		// 5. Cadenas de valor vacías o sin costear
		if activityCostMap[p.ID] <= 0 {
			countCadenaValor++
			isBlocked = true
		}

		if isBlocked {
			blockedProjects++
		} else {
			readyProjects++
		}
	}

	issues := []dto.AuditRadarIssue{
		{Issue: "Falta descripción del problema central", Count: countProblem},
		{Issue: "Falta objetivo general", Count: countObjective},
		{Issue: "Situación existente incompleta", Count: countSituacion},
		{Issue: "Magnitud del problema sin justificar", Count: countMagnitud},
		{Issue: "Cadenas de valor vacías o sin costear", Count: countCadenaValor},
	}

	for i := range issues {
		if totalAudited > 0 {
			issues[i].Percentage = math.Round((float64(issues[i].Count)/float64(totalAudited))*10000) / 100
		}
	}

	sort.Slice(issues, func(i, j int) bool {
		if issues[i].Count == issues[j].Count {
			return issues[i].Issue < issues[j].Issue
		}
		return issues[i].Count > issues[j].Count
	})

	return &dto.AuditRadarReportResponse{
		TotalAudited:    totalAudited,
		ReadyProjects:   readyProjects,
		BlockedProjects: blockedProjects,
		TopErrors:       issues,
	}, nil
}


