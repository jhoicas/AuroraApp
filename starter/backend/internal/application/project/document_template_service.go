package project

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html"
	htmltemplate "html/template"
	"regexp"
	"strings"
	"time"

	"aurora-backend/internal/domain/models"
	"aurora-backend/internal/infrastructure/persistence/postgres"

	"github.com/google/uuid"
)

// DocumentTemplateService renderiza plantillas HTML (TipTap) a PDF inyectando datos del proyecto.
type DocumentTemplateService struct{}

func NewDocumentTemplateService() *DocumentTemplateService { return &DocumentTemplateService{} }

var (
	// <span class="mga-var" data-id="project.name">…</span> (atributos en cualquier orden).
	mgaVarSpanRe = regexp.MustCompile(`(?is)<span\b[^>]*>.*?</span>`)
	mgaVarIDRe   = regexp.MustCompile(`(?i)\bdata-id="([A-Za-z0-9_.-]+)"`)
	mgaVarClsRe  = regexp.MustCompile(`(?i)\bclass="[^"]*\bmga-var\b[^"]*"`)
)

// PreprocessTemplate neutraliza cualquier acción de plantilla escrita por el usuario y convierte
// cada nodo mga-var en la acción {{v "id"}}. El HTML del usuario nunca ejecuta lógica propia.
func PreprocessTemplate(src string) string {
	safe := strings.ReplaceAll(src, "{{", `{{"{{"}}`)
	return mgaVarSpanRe.ReplaceAllStringFunc(safe, func(m string) string {
		open := m[:strings.Index(m, ">")+1]
		if !mgaVarClsRe.MatchString(open) {
			return m
		}
		id := mgaVarIDRe.FindStringSubmatch(open)
		if id == nil {
			return m
		}
		return `{{v "` + id[1] + `"}}`
	})
}

// RenderTemplateHTML inyecta los datos en la plantilla con html/template (escape contextual).
func RenderTemplateHTML(tplHTML string, data map[string]any) (string, error) {
	t, err := htmltemplate.New("doc").Funcs(htmltemplate.FuncMap{
		"v": func(id string) any {
			if val, ok := data[id]; ok {
				return val
			}
			return ""
		},
	}).Parse(PreprocessTemplate(tplHTML))
	if err != nil {
		return "", fmt.Errorf("parse template: %w", err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, nil); err != nil {
		return "", fmt.Errorf("execute template: %w", err)
	}
	return buf.String(), nil
}

// BuildTemplateData arma el mapa de variables MGA (clave "grupo.campo") del proyecto.
// Los arreglos (causas, efectos, objetivos específicos, entregables…) se entregan ya renderizados como
// listas HTML: la plantilla del usuario nunca ejecuta {{range}} propio (ver PreprocessTemplate).
func BuildTemplateData(project *models.Project, bundle *postgres.MgaFullFormulation, budget []models.BudgetItem, edt *postgres.ProjectEdtChain) map[string]any {
	var form FormulationDataWrapper
	if len(project.MgaFormulationData) > 0 {
		_ = json.Unmarshal(project.MgaFormulationData, &form)
	}
	code := ""
	if project.CodeBPIN != nil {
		code = *project.CodeBPIN
	}
	object := form.Objeto
	if object == "" {
		object = project.Description
	}

	var causes, effects []string
	if bundle != nil {
		for _, c := range bundle.Causes {
			causes = append(causes, c.Description)
		}
		for _, e := range bundle.Effects {
			effects = append(effects, e.Description)
		}
	}

	var total float64
	var rows strings.Builder
	for _, b := range budget {
		total += b.Amount
		rows.WriteString("<tr><td>" + html.EscapeString(b.Description) + "</td><td>" + html.EscapeString(formatCurrency(b.Amount)) + "</td></tr>")
	}
	budgetTable := ""
	if rows.Len() > 0 {
		budgetTable = "<table><tr><th>Concepto</th><th>Valor</th></tr>" + rows.String() + "</table>"
	}

	justificacion := project.MagnitudProblema
	if justificacion == "" {
		justificacion = project.Description
	}
	dep, mun := locationNames(form.Localizaciones)
	if dep == "" {
		dep = "Valle del Cauca"
	}

	return map[string]any{
		"project.bpin":         orDefault(code, "En radicación"),
		"project.name":         project.Name,
		"project.code":         code,
		"project.program_code": derefStr(project.ProgramCode),
		"project.product_code": derefStr(project.ProductCode),
		"project.sector":       project.Sector,
		"project.status":       project.Status,
		"project.phase":        project.FaseMaduracion,
		"project.object":       object,
		"project.created_at":   project.CreatedAt.Format("02/01/2006"),
		"tenant.name":          project.Tenant.Name,
		"tenant.nit":           derefStr(project.Tenant.NIT),
		"problem.description":  project.ProblemDescription,
		"problem.situation":    project.SituacionExistente,
		"problem.magnitude":    project.MagnitudProblema,
		"problem.causes":       listHTML(causes),
		"problem.effects":      listHTML(effects),
		"objective.general":    project.GeneralObjective,
		"budget.total":         formatCurrency(total),
		"budget.items":         htmltemplate.HTML(budgetTable),
		"today":                time.Now().Format("02/01/2006"),
		"system.date":          time.Now().Format("02/01/2006"),

		"plan-desarrollo.nacional":      fallbackHTML(listHTML(pndLines(form.PlanDesarrollo)), "Sin articulación PND registrada."),
		"plan-desarrollo.departamental": orDefault(planLine(departamental(form.PlanDesarrollo)), "Alineado con el Plan Departamental de Desarrollo del Valle del Cauca."),
		"plan-desarrollo.municipal":     orDefault(planLine(municipal(form.PlanDesarrollo)), "Sin articulación municipal registrada."),

		"problematica.problemaCentral":      project.ProblemDescription,
		"problematica.descripcionSituacion": project.SituacionExistente,
		"problematica.magnitudIndicadores":  justificacion,

		"objetivos.objetivoGeneral": project.GeneralObjective,
		"objetivos.especificos":     fallbackHTML(listHTML(specificObjectives(bundle)), "Objetivos específicos en proceso de consolidación en la matriz MGA."),

		"arbol.causas":  fallbackHTML(nestedListHTML(causeTree(bundle)), "Sin causas registradas."),
		"arbol.efectos": fallbackHTML(nestedListHTML(effectTree(bundle)), "Sin efectos registrados."),
		"arbol.medios":  fallbackHTML(listHTML(specificObjectives(bundle)), "Sin medios registrados."),
		"arbol.fines":   fallbackHTML(listHTML(prefixAll(effectDescriptions(bundle), "Mitigación de: ")), "Sin fines registrados."),

		"poblacion.afectada": populationText(bundle, "afectada"),
		"poblacion.objetivo": populationText(bundle, "objetivo"),

		"identificacion.alternativa": selectedAlternative(bundle),

		"preparacion.producto":    productText(project, edt),
		"preparacion.entregables": fallbackHTML(listHTML(deliverableLines(edt)), "Entregables definidos según el alcance de los bienes y servicios proyectados."),

		"localizacion.departamento": dep,
		"localizacion.municipio":    orDefault(mun, "Por definir"),
	}
}

func orDefault(s, def string) string {
	if strings.TrimSpace(s) == "" {
		return def
	}
	return s
}

func fallbackHTML(h htmltemplate.HTML, def string) htmltemplate.HTML {
	if h == "" {
		return htmltemplate.HTML(html.EscapeString(def))
	}
	return h
}

type planParts struct{ Plan, Estrategia, Programa string }

func departamental(p *PlanDesarrolloPayload) planParts {
	if p == nil || p.Departamental == nil {
		return planParts{}
	}
	return planParts{p.Departamental.Plan, p.Departamental.Estrategia, p.Departamental.Programa}
}

func municipal(p *PlanDesarrolloPayload) planParts {
	if p == nil || p.Municipal == nil {
		return planParts{}
	}
	return planParts{p.Municipal.Plan, p.Municipal.Estrategia, p.Municipal.Programa}
}

func planLine(pp planParts) string {
	return joinNonEmpty(" / ", pp.Plan, pp.Estrategia, pp.Programa)
}

func joinNonEmpty(sep string, parts ...string) string {
	var out []string
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return strings.Join(out, sep)
}

func pndLines(p *PlanDesarrolloPayload) []string {
	if p == nil {
		return nil
	}
	var out []string
	for _, l := range p.PndLinks {
		if line := joinNonEmpty(" / ", l.Nacional, l.Pilar, l.Estrategia, l.Programa); line != "" {
			out = append(out, line)
		}
	}
	return out
}

func isDirect(t string, parent *uuid.UUID) bool {
	return t == "directa" || t == "directo" || parent == nil
}

type treeNode struct {
	text     string
	children []string
}

// buildTree agrupa ítems indirectos bajo su padre directo (huérfanos quedan al primer nivel).
func buildTree(n int, id func(i int) uuid.UUID, parent func(i int) *uuid.UUID, kind func(i int) string, text func(i int) string) []treeNode {
	var out []treeNode
	index := map[uuid.UUID]int{}
	for i := 0; i < n; i++ {
		if isDirect(kind(i), parent(i)) {
			index[id(i)] = len(out)
			out = append(out, treeNode{text: text(i)})
		}
	}
	for i := 0; i < n; i++ {
		if isDirect(kind(i), parent(i)) {
			continue
		}
		if j, ok := index[*parent(i)]; ok {
			out[j].children = append(out[j].children, text(i))
		} else {
			out = append(out, treeNode{text: text(i)})
		}
	}
	return out
}

func causeTree(b *postgres.MgaFullFormulation) []treeNode {
	if b == nil {
		return nil
	}
	c := b.Causes
	return buildTree(len(c),
		func(i int) uuid.UUID { return c[i].ID }, func(i int) *uuid.UUID { return c[i].ParentID },
		func(i int) string { return c[i].CauseType }, func(i int) string { return c[i].Description })
}

func effectTree(b *postgres.MgaFullFormulation) []treeNode {
	if b == nil {
		return nil
	}
	e := b.Effects
	return buildTree(len(e),
		func(i int) uuid.UUID { return e[i].ID }, func(i int) *uuid.UUID { return e[i].ParentID },
		func(i int) string { return e[i].EffectType }, func(i int) string { return e[i].Description })
}

func nestedListHTML(nodes []treeNode) htmltemplate.HTML {
	if len(nodes) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("<ul>")
	for _, n := range nodes {
		b.WriteString("<li>" + html.EscapeString(n.text))
		if len(n.children) > 0 {
			b.WriteString("<ul>")
			for _, c := range n.children {
				b.WriteString("<li>" + html.EscapeString(c) + "</li>")
			}
			b.WriteString("</ul>")
		}
		b.WriteString("</li>")
	}
	b.WriteString("</ul>")
	return htmltemplate.HTML(b.String())
}

func specificObjectives(b *postgres.MgaFullFormulation) []string {
	if b == nil {
		return nil
	}
	var out []string
	for _, c := range b.Causes {
		if c.SpecificObjective != nil && strings.TrimSpace(c.SpecificObjective.Description) != "" {
			out = append(out, c.SpecificObjective.Description)
		}
	}
	if len(out) == 0 {
		for _, c := range b.Causes {
			if isDirect(c.CauseType, c.ParentID) {
				out = append(out, "Superar: "+c.Description)
			}
		}
	}
	return out
}

func effectDescriptions(b *postgres.MgaFullFormulation) []string {
	if b == nil {
		return nil
	}
	var out []string
	for _, e := range b.Effects {
		out = append(out, e.Description)
	}
	return out
}

func prefixAll(items []string, prefix string) []string {
	out := make([]string, len(items))
	for i, it := range items {
		out[i] = prefix + it
	}
	return out
}

func populationText(b *postgres.MgaFullFormulation, kind string) string {
	const none = "Población en proceso de consolidación censal."
	if b == nil {
		return none
	}
	var parts []string
	for _, p := range b.Populations {
		if !strings.EqualFold(p.PopulationType, kind) {
			continue
		}
		t := fmt.Sprintf("%d personas", p.TotalNumber)
		if p.Source != "" {
			t += " (Fuente: " + p.Source + ")"
		}
		parts = append(parts, t)
	}
	if len(parts) == 0 {
		return none
	}
	return strings.Join(parts, "; ")
}

func selectedAlternative(b *postgres.MgaFullFormulation) string {
	if b == nil || len(b.Alternatives) == 0 {
		return "Alternativa única seleccionada conforme a las especificaciones técnicas de la MGA."
	}
	for _, a := range b.Alternatives {
		if a.ProceedsToPreparation {
			return a.Description
		}
	}
	return b.Alternatives[0].Description
}

func productText(project *models.Project, edt *postgres.ProjectEdtChain) string {
	if edt != nil && edt.CatalogLink != nil {
		return joinNonEmpty(" - ", edt.CatalogLink.ProductCode, edt.CatalogLink.Tipologia)
	}
	if project.ProductCode != nil && *project.ProductCode != "" {
		return *project.ProductCode
	}
	return "Producto en proceso de homologación con el catálogo DNP."
}

func deliverableLines(edt *postgres.ProjectEdtChain) []string {
	if edt == nil {
		return nil
	}
	var out []string
	for _, d := range edt.Deliverables {
		out = append(out, joinNonEmpty(" - ", d.Code, d.Name))
	}
	return out
}

func locationNames(locs []LocationSelectionPayload) (dep, mun string) {
	var deps, muns []string
	seenD, seenM := map[string]bool{}, map[string]bool{}
	for _, l := range locs {
		if l.DepartamentoName != "" && !seenD[l.DepartamentoName] {
			seenD[l.DepartamentoName] = true
			deps = append(deps, l.DepartamentoName)
		}
		if l.MunicipioName != "" && !seenM[l.MunicipioName] {
			seenM[l.MunicipioName] = true
			muns = append(muns, l.MunicipioName)
		}
	}
	return strings.Join(deps, ", "), strings.Join(muns, ", ")
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func listHTML(items []string) htmltemplate.HTML {
	if len(items) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("<ul>")
	for _, it := range items {
		b.WriteString("<li>" + html.EscapeString(it) + "</li>")
	}
	b.WriteString("</ul>")
	return htmltemplate.HTML(b.String())
}

// RenderPDF renderiza la plantilla con los datos y la convierte a PDF (Chromium headless).
func (s *DocumentTemplateService) RenderPDF(tpl *models.DocumentTemplate, data map[string]any) ([]byte, error) {
	rendered, err := RenderTemplateHTML(tpl.HTMLContent, data)
	if err != nil {
		return nil, err
	}
	return HTMLToPDF(rendered)
}
