package project

import (
	"context"
	"encoding/json"
	"strings"

	"aurora-backend/internal/domain/models"

	"github.com/google/uuid"
)

// AuditFinding hallazgo estructurado del validador de formulación MGA.
type AuditFinding struct {
	ID         string `json:"id"`
	Message    string `json:"message"`
	Severity   string `json:"severity"`    // "CRITICAL" | "WARNING" | "SUCCESS"
	SectionKey string `json:"section_key"` // Identificador de pestaña/sección MGA
	IsResolved bool   `json:"is_resolved"`
}

// AuditResult resultado de la auditoría previa de formulación MGA.
type AuditResult struct {
	Passed   bool           `json:"passed"`
	Findings []AuditFinding `json:"findings"`
	Blockers []string       `json:"blockers"`
	Warnings []string       `json:"warnings"`
}

// ProjectReader resuelve proyectos con ownership multi-tenant.
type ProjectReader interface {
	FindOwned(ctx context.Context, projectID, tenantID uuid.UUID) (*models.Project, error)
}

// MgaFormulationCounter expone conteos de entidades MGA para auditoría.
type MgaFormulationCounter interface {
	CountCauses(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error)
	CountSpecificObjectives(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error)
	CountDirectCauses(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error)
	CountDirectEffects(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error)
	CountTargetPopulations(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error)
	CountAlternatives(ctx context.Context, projectID, tenantID uuid.UUID) (int64, error)
}

// EdtActivityReader consulta actividades de la cadena de valor EDT.
type EdtActivityReader interface {
	ListActivities(ctx context.Context, projectID, tenantID uuid.UUID) ([]models.ProjectActivity, error)
}

// FormulationAuditService evalúa requisitos mínimos de formulación antes de viabilidad.
type FormulationAuditService struct {
	projects ProjectReader
	mga      MgaFormulationCounter
	edt      EdtActivityReader
}

func NewFormulationAuditService(
	projects ProjectReader,
	mga MgaFormulationCounter,
	edt ...EdtActivityReader,
) *FormulationAuditService {
	var edtReader EdtActivityReader
	if len(edt) > 0 {
		edtReader = edt[0]
	}
	return &FormulationAuditService{
		projects: projects,
		mga:      mga,
		edt:      edtReader,
	}
}

const minIdentificationTextLen = 100

type auditFormulationData struct {
	Situation           string `json:"situation"`
	SituacionExistente  string `json:"situacion_existente"`
	Magnitude           string `json:"magnitude"`
	MagnitudProblema    string `json:"magnitud_problema"`
	ProjectHorizon      int    `json:"project_horizon"`
	HorizonteEvaluacion int    `json:"horizonte_evaluacion"`
	AnalisisTecnico     *struct {
		ProjectHorizon      int               `json:"project_horizon"`
		HorizonteEvaluacion int               `json:"horizonte_evaluacion"`
		Items               map[string]string `json:"items"`
	} `json:"analisisTecnico"`
	AnalisisTecnicoSnake *struct {
		ProjectHorizon      int               `json:"project_horizon"`
		HorizonteEvaluacion int               `json:"horizonte_evaluacion"`
		Items               map[string]string `json:"items"`
	} `json:"analisis_tecnico"`
	Riesgos *struct {
		Items []struct {
			ID                  string `json:"id"`
			ClassificationLevel string `json:"classification_level"`
			Mitigation          string `json:"mitigation"`
			Medida              string `json:"medida"`
			Effect              string `json:"effect"`
			Efectos             string `json:"efectos"`
		} `json:"items"`
	} `json:"riesgos"`
	Evaluacion *struct {
		OpportunityInterestRate *float64 `json:"opportunity_interest_rate"`
		TasaDescuento           *float64 `json:"tasa_descuento"`
		Resumen                 string   `json:"resumen"`
		VPN                     *float64 `json:"vpn"`
		RCB                     *float64 `json:"rcb"`
		CAE                     *float64 `json:"cae"`
		VPC                     *float64 `json:"vpc"`
	} `json:"evaluacion"`
	Localizaciones []struct {
		RegionID            *int `json:"region_id"`
		RegionIDCamel       *int `json:"regionId"`
		DepartamentoID      *int `json:"departamento_id"`
		DepartamentoIDCamel *int `json:"departamentoId"`
		MunicipioID         *int `json:"municipio_id"`
		MunicipioIDCamel    *int `json:"municipioId"`
		TipoAgrupacionID    *int `json:"tipo_agrupacion_id"`
		AgrupacionID        *int `json:"agrupacion_id"`
	} `json:"localizaciones"`
	Localizacion *struct {
		Items map[string]struct {
			Type     string `json:"type"`
			Specific string `json:"specific"`
		} `json:"items"`
		Localizaciones []struct {
			RegionID            *int `json:"region_id"`
			RegionIDCamel       *int `json:"regionId"`
			DepartamentoID      *int `json:"departamento_id"`
			DepartamentoIDCamel *int `json:"departamentoId"`
			MunicipioID         *int `json:"municipio_id"`
			MunicipioIDCamel    *int `json:"municipioId"`
		} `json:"localizaciones"`
	} `json:"localizacion"`
}

func hasDefinedLocalization(data []byte) bool {
	if len(data) == 0 {
		return false
	}
	var parsed auditFormulationData
	if err := json.Unmarshal(data, &parsed); err != nil {
		return false
	}
	for _, loc := range parsed.Localizaciones {
		if loc.RegionID != nil || loc.RegionIDCamel != nil || loc.DepartamentoID != nil || loc.DepartamentoIDCamel != nil || loc.MunicipioID != nil || loc.MunicipioIDCamel != nil {
			return true
		}
	}
	if parsed.Localizacion != nil {
		for _, loc := range parsed.Localizacion.Localizaciones {
			if loc.RegionID != nil || loc.RegionIDCamel != nil || loc.DepartamentoID != nil || loc.DepartamentoIDCamel != nil || loc.MunicipioID != nil || loc.MunicipioIDCamel != nil {
				return true
			}
		}
		if len(parsed.Localizacion.Items) > 0 {
			for _, item := range parsed.Localizacion.Items {
				if strings.TrimSpace(item.Type) != "" || strings.TrimSpace(item.Specific) != "" {
					return true
				}
			}
		}
	}
	return false
}

// AuditProject ejecuta una validación híbrida determinista de requisitos mínimos MGA.
func (s *FormulationAuditService) AuditProject(
	ctx context.Context,
	tenantID, projectID uuid.UUID,
) (AuditResult, error) {
	project, err := s.projects.FindOwned(ctx, projectID, tenantID)
	if err != nil {
		return AuditResult{}, err
	}

	findings := make([]AuditFinding, 0, 16)
	blockers := make([]string, 0, 8)
	warnings := make([]string, 0, 8)

	// Helper para añadir hallazgo
	addFinding := func(id, message, severity, sectionKey string, isResolved bool) {
		findings = append(findings, AuditFinding{
			ID:         id,
			Message:    message,
			Severity:   severity,
			SectionKey: sectionKey,
			IsResolved: isResolved,
		})
		if severity == "CRITICAL" {
			blockers = append(blockers, message)
		} else if severity == "WARNING" {
			warnings = append(warnings, message)
		}
	}

	// 1. REQUISITO ESTRUCTURAL: Problema central sin al menos 1 causa y 1 efecto
	problemDesc := strings.TrimSpace(project.ProblemDescription)
	hasProblem := problemDesc != ""
	if !hasProblem {
		addFinding(
			"crit-problem-desc",
			"Debe registrar la descripción del problema central (pestaña Problemática).",
			"CRITICAL",
			"identificacion",
			false,
		)
	}

	directCauseCount, err := s.mga.CountDirectCauses(ctx, projectID, tenantID)
	if err != nil {
		return AuditResult{}, err
	}
	if directCauseCount == 0 {
		addFinding(
			"crit-direct-cause",
			"El árbol de problemas debe incluir al menos una causa directa que origine el problema (pestaña Problemática).",
			"CRITICAL",
			"identificacion",
			false,
		)
	}

	directEffectCount, err := s.mga.CountDirectEffects(ctx, projectID, tenantID)
	if err != nil {
		return AuditResult{}, err
	}
	if directEffectCount == 0 {
		addFinding(
			"crit-direct-effect",
			"El árbol de problemas debe incluir al menos un efecto directo generado por el problema (pestaña Problemática).",
			"CRITICAL",
			"identificacion",
			false,
		)
	}

	causeCount, err := s.mga.CountCauses(ctx, projectID, tenantID)
	if err != nil {
		return AuditResult{}, err
	}
	if causeCount == 0 && directCauseCount > 0 {
		addFinding(
			"crit-causes",
			"Debe existir al menos una causa registrada en la formulación MGA.",
			"CRITICAL",
			"identificacion",
			false,
		)
	}

	if hasProblem && directCauseCount > 0 && directEffectCount > 0 {
		addFinding(
			"succ-problem-tree",
			"Problema central y relaciones causales (causas y efectos directos) estructurados correctamente.",
			"SUCCESS",
			"identificacion",
			true,
		)
	}

	// 2. REQUISITO ESTRUCTURAL: Ausencia de población objetivo o falta de localización definida
	targetPopCount, err := s.mga.CountTargetPopulations(ctx, projectID, tenantID)
	if err != nil {
		return AuditResult{}, err
	}
	if targetPopCount == 0 {
		addFinding(
			"crit-target-population",
			"Debe registrar y caracterizar al menos una población objetivo para el proyecto (pestaña Población).",
			"CRITICAL",
			"poblacion",
			false,
		)
	} else {
		addFinding(
			"succ-target-population",
			"Población objetivo identificada y caracterizada en la formulación.",
			"SUCCESS",
			"poblacion",
			true,
		)
	}

	hasLocation := hasDefinedLocalization(project.MgaFormulationData)
	if !hasLocation {
		addFinding(
			"crit-localization",
			"Debe definir la localización geográfica y territorial de intervención del proyecto (pestaña Localización).",
			"CRITICAL",
			"localizacion",
			false,
		)
	} else {
		addFinding(
			"succ-localization",
			"Localización territorial del proyecto delimitada conforme al área de intervención.",
			"SUCCESS",
			"localizacion",
			true,
		)
	}

	// 3. REQUISITO ESTRUCTURAL: Objetivos específicos sin al menos una alternativa asociada
	if strings.TrimSpace(project.GeneralObjective) == "" {
		addFinding(
			"crit-general-objective",
			"El proyecto debe tener definido un objetivo general (pestaña Objetivos).",
			"CRITICAL",
			"objetivos",
			false,
		)
	}

	objectiveCount, err := s.mga.CountSpecificObjectives(ctx, projectID, tenantID)
	if err != nil {
		return AuditResult{}, err
	}
	if objectiveCount == 0 {
		addFinding(
			"crit-specific-objectives",
			"Debe existir al menos un objetivo específico vinculado a las causas directas (pestaña Objetivos).",
			"CRITICAL",
			"objetivos",
			false,
		)
	} else {
		addFinding(
			"succ-specific-objectives",
			"Objetivos específicos alineados a la estructura del proyecto.",
			"SUCCESS",
			"objetivos",
			true,
		)
	}

	alternativeCount, err := s.mga.CountAlternatives(ctx, projectID, tenantID)
	if err != nil {
		return AuditResult{}, err
	}
	if alternativeCount == 0 {
		addFinding(
			"crit-alternatives",
			"Los objetivos específicos deben contar con al menos una alternativa de solución evaluada (pestaña Alternativas).",
			"CRITICAL",
			"alternativas",
			false,
		)
	} else {
		addFinding(
			"succ-alternatives",
			"Alternativas de solución planteadas y evaluadas.",
			"SUCCESS",
			"alternativas",
			true,
		)
	}

	// 4. REQUISITO ESTRUCTURAL: Cadena de valor sin actividades, o actividades sin costo presupuestado
	if s.edt != nil {
		activities, err := s.edt.ListActivities(ctx, projectID, tenantID)
		if err != nil {
			return AuditResult{}, err
		}
		if len(activities) == 0 {
			addFinding(
				"crit-edt-activities-empty",
				"La cadena de valor (EDT) debe contener al menos una actividad presupuestada (pestaña Cadena de Valor).",
				"CRITICAL",
				"cadena-valor",
				false,
			)
		} else {
			hasWithoutCost := false
			for _, act := range activities {
				if act.TotalCost <= 0 || act.UnitCost <= 0 {
					hasWithoutCost = true
					break
				}
			}
			if hasWithoutCost {
				addFinding(
					"crit-edt-activities-zero-cost",
					"Todas las actividades de la cadena de valor EDT deben tener un costo unitario y total presupuestado mayor a cero.",
					"CRITICAL",
					"cadena-valor",
					false,
				)
			} else {
				addFinding(
					"succ-edt-activities",
					"Cadena de valor EDT con actividades y presupuesto costeadas.",
					"SUCCESS",
					"cadena-valor",
					true,
				)
			}
		}
	}

	// 5. EVALUACIÓN CUALITATIVA / COHERENCIA NARRATIVA
	var parsed auditFormulationData
	if len(project.MgaFormulationData) > 0 {
		_ = json.Unmarshal(project.MgaFormulationData, &parsed)
	}

	situacion := strings.TrimSpace(project.SituacionExistente)
	if situacion == "" {
		if strings.TrimSpace(parsed.Situation) != "" {
			situacion = strings.TrimSpace(parsed.Situation)
		} else if strings.TrimSpace(parsed.SituacionExistente) != "" {
			situacion = strings.TrimSpace(parsed.SituacionExistente)
		}
	}
	if situacion == "" {
		addFinding(
			"warn-situacion-empty",
			"Debe completar la descripción de la situación existente y antecedentes (pestaña Problemática).",
			"WARNING",
			"identificacion",
			false,
		)
	} else if len(situacion) <= minIdentificationTextLen {
		addFinding(
			"warn-situacion-short",
			"La descripción de la situación existente debe superar 100 caracteres para asegurar coherencia narrativa.",
			"WARNING",
			"identificacion",
			false,
		)
	} else {
		addFinding(
			"succ-situacion",
			"Descripción de la situación existente y antecedentes estructurada conforme a la metodología MGA.",
			"SUCCESS",
			"identificacion",
			true,
		)
	}

	magnitud := strings.TrimSpace(project.MagnitudProblema)
	if magnitud == "" {
		if strings.TrimSpace(parsed.Magnitude) != "" {
			magnitud = strings.TrimSpace(parsed.Magnitude)
		} else if strings.TrimSpace(parsed.MagnitudProblema) != "" {
			magnitud = strings.TrimSpace(parsed.MagnitudProblema)
		}
	}
	if magnitud == "" {
		addFinding(
			"warn-magnitud-empty",
			"Debe completar la magnitud actual del problema (pestaña Problemática).",
			"WARNING",
			"identificacion",
			false,
		)
	} else if len(magnitud) <= minIdentificationTextLen {
		addFinding(
			"warn-magnitud-short",
			"La magnitud del problema debe superar 100 caracteres para reflejar la dimensión técnica y social.",
			"WARNING",
			"identificacion",
			false,
		)
	} else {
		addFinding(
			"succ-magnitud",
			"Magnitud actual del problema e indicadores de referencia cuantificados.",
			"SUCCESS",
			"identificacion",
			true,
		)
	}

	// 6. SUB-CAMPOS METODOLÓGICOS MGA: ANÁLISIS TÉCNICO, RIESGOS Y EVALUACIÓN
	horizon := 0
	if parsed.AnalisisTecnico != nil {
		if parsed.AnalisisTecnico.ProjectHorizon > 0 {
			horizon = parsed.AnalisisTecnico.ProjectHorizon
		} else if parsed.AnalisisTecnico.HorizonteEvaluacion > 0 {
			horizon = parsed.AnalisisTecnico.HorizonteEvaluacion
		}
	}
	if horizon == 0 && parsed.AnalisisTecnicoSnake != nil {
		if parsed.AnalisisTecnicoSnake.ProjectHorizon > 0 {
			horizon = parsed.AnalisisTecnicoSnake.ProjectHorizon
		} else if parsed.AnalisisTecnicoSnake.HorizonteEvaluacion > 0 {
			horizon = parsed.AnalisisTecnicoSnake.HorizonteEvaluacion
		}
	}
	if horizon == 0 {
		if parsed.ProjectHorizon > 0 {
			horizon = parsed.ProjectHorizon
		} else if parsed.HorizonteEvaluacion > 0 {
			horizon = parsed.HorizonteEvaluacion
		}
	}
	if horizon > 0 {
		addFinding(
			"succ-horizon",
			"Horizonte de evaluación del proyecto definido y validado (pestaña Análisis Técnico).",
			"SUCCESS",
			"analisis-tecnico",
			true,
		)
	} else if parsed.AnalisisTecnico != nil || parsed.AnalisisTecnicoSnake != nil {
		addFinding(
			"warn-horizon",
			"Debe especificar el horizonte de evaluación en años en el análisis técnico.",
			"WARNING",
			"analisis-tecnico",
			false,
		)
	}

	if parsed.Riesgos != nil && len(parsed.Riesgos.Items) > 0 {
		allHaveMitigationAndLevel := true
		for _, r := range parsed.Riesgos.Items {
			mit := strings.TrimSpace(r.Mitigation)
			if mit == "" {
				mit = strings.TrimSpace(r.Medida)
			}
			level := strings.TrimSpace(r.ClassificationLevel)
			if mit == "" || level == "" {
				allHaveMitigationAndLevel = false
				break
			}
		}
		if allHaveMitigationAndLevel {
			addFinding(
				"succ-riesgos-detail",
				"Matriz de riesgos con niveles de clasificación metodológica y medidas de mitigación completas.",
				"SUCCESS",
				"riesgos",
				true,
			)
		} else {
			addFinding(
				"warn-riesgos-detail",
				"Todos los riesgos deben especificar su nivel de clasificación (Propósito, Componente, Actividad) y medida de mitigación.",
				"WARNING",
				"riesgos",
				false,
			)
		}
	}

	if parsed.Evaluacion != nil {
		rate := 0.0
		if parsed.Evaluacion.OpportunityInterestRate != nil {
			rate = *parsed.Evaluacion.OpportunityInterestRate
		} else if parsed.Evaluacion.TasaDescuento != nil {
			rate = *parsed.Evaluacion.TasaDescuento
		}

		if rate > 0 {
			addFinding(
				"succ-evaluacion-rate",
				"Tasa de interés de oportunidad / descuento y criterios de evaluación económica registrados.",
				"SUCCESS",
				"evaluacion",
				true,
			)
		} else {
			addFinding(
				"warn-evaluacion-rate",
				"Debe registrar la tasa de interés de oportunidad / descuento (pestaña Evaluación).",
				"WARNING",
				"evaluacion",
				false,
			)
		}
	}

	return AuditResult{
		Passed:   len(blockers) == 0,
		Findings: findings,
		Blockers: blockers,
		Warnings: warnings,
	}, nil
}
