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
	"github.com/jung-kurt/gofpdf"
	xhtml "golang.org/x/net/html"
	"golang.org/x/net/html/atom"
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
		"project.bpin":        orDefault(code, "En radicación"),
		"project.name":        project.Name,
		"project.code":        code,
		"project.sector":      project.Sector,
		"project.status":      project.Status,
		"project.phase":       project.FaseMaduracion,
		"project.object":      object,
		"project.created_at":  project.CreatedAt.Format("02/01/2006"),
		"tenant.name":         project.Tenant.Name,
		"tenant.nit":          derefStr(project.Tenant.NIT),
		"problem.description": project.ProblemDescription,
		"problem.situation":   project.SituacionExistente,
		"problem.magnitude":   project.MagnitudProblema,
		"problem.causes":      listHTML(causes),
		"problem.effects":     listHTML(effects),
		"objective.general":   project.GeneralObjective,
		"budget.total":        formatCurrency(total),
		"budget.items":        htmltemplate.HTML(budgetTable),
		"today":               time.Now().Format("02/01/2006"),
		"system.date":         time.Now().Format("02/01/2006"),

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

// RenderPDF renderiza la plantilla con los datos y la convierte a PDF.
func (s *DocumentTemplateService) RenderPDF(tpl *models.DocumentTemplate, data map[string]any) ([]byte, error) {
	rendered, err := RenderTemplateHTML(tpl.HTMLContent, data)
	if err != nil {
		return nil, err
	}
	return HTMLToPDF(rendered)
}

// ---------- HTML → PDF (subconjunto: encabezados, párrafos, listas, tablas, negrita/cursiva/subrayado) ----------

type inlineRun struct {
	text                string
	bold, italic, under bool
}

type pdfWriter struct {
	pdf    *gofpdf.Fpdf
	txt    func(string) string
	indent float64 // sangría izquierda (mm) para listas anidadas
}

// HTMLToPDF convierte el HTML renderizado (subconjunto soportado por TipTap StarterKit) a PDF A4.
func HTMLToPDF(src string) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 18, 15)
	pdf.SetAutoPageBreak(true, 18)
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	w := &pdfWriter{pdf: pdf, txt: func(s string) string { return tr(sanitizeText(s)) }}
	pdf.SetFooterFunc(func() {
		pdf.SetY(-12)
		pdf.SetFont("Arial", "", 8)
		pdf.SetTextColor(100, 116, 139)
		pdf.CellFormat(0, 5, w.txt(fmt.Sprintf("Página %d", pdf.PageNo())), "", 0, "C", false, 0, "")
		pdf.SetTextColor(0, 0, 0)
	})
	pdf.AddPage()

	body := &xhtml.Node{Type: xhtml.ElementNode, DataAtom: atom.Body, Data: "body"}
	nodes, err := xhtml.ParseFragment(strings.NewReader(src), body)
	if err != nil {
		return nil, fmt.Errorf("parse html: %w", err)
	}
	w.blocks(nodes, "")
	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func isBlockAtom(a atom.Atom) bool {
	switch a {
	case atom.P, atom.H1, atom.H2, atom.H3, atom.H4, atom.H5, atom.H6, atom.Ul, atom.Ol, atom.Li,
		atom.Table, atom.Div, atom.Hr, atom.Blockquote, atom.Pre:
		return true
	}
	return false
}

func styleAlign(n *xhtml.Node) string {
	for _, a := range n.Attr {
		if a.Key == "style" {
			low := strings.ToLower(a.Val)
			switch {
			case strings.Contains(low, "text-align: center"), strings.Contains(low, "text-align:center"):
				return "C"
			case strings.Contains(low, "text-align: right"), strings.Contains(low, "text-align:right"):
				return "R"
			case strings.Contains(low, "text-align: justify"), strings.Contains(low, "text-align:justify"):
				return "J"
			}
		}
	}
	return ""
}

// blocks recorre hermanos: acumula inline en un párrafo implícito y emite bloques.
func (w *pdfWriter) blocks(nodes []*xhtml.Node, align string) {
	var pending []inlineRun
	flush := func() {
		w.paragraph(pending, align, 5, 11, 1.5)
		pending = nil
	}
	for _, n := range nodes {
		if n.Type == xhtml.ElementNode && isBlockAtom(n.DataAtom) {
			flush()
			w.block(n, align)
			continue
		}
		pending = append(pending, collectInline(n, false, false, false)...)
	}
	flush()
}

func childList(n *xhtml.Node) []*xhtml.Node {
	var out []*xhtml.Node
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		out = append(out, c)
	}
	return out
}

func (w *pdfWriter) block(n *xhtml.Node, inherited string) {
	align := styleAlign(n)
	if align == "" {
		align = inherited
	}
	switch n.DataAtom {
	case atom.H1, atom.H2, atom.H3, atom.H4, atom.H5, atom.H6:
		size := map[atom.Atom]float64{atom.H1: 18, atom.H2: 14, atom.H3: 12, atom.H4: 11, atom.H5: 11, atom.H6: 11}[n.DataAtom]
		runs := collectInline(n, true, false, false)
		w.paragraph(runs, align, size*0.5, size, 2)
	case atom.P, atom.Pre, atom.Blockquote:
		w.blocksChildren(n, align)
	case atom.Ul, atom.Ol:
		w.list(n, 0)
	case atom.Table:
		w.table(n)
	case atom.Hr:
		y := w.pdf.GetY() + 2
		w.pdf.SetDrawColor(203, 213, 225)
		w.pdf.Line(15, y, 195, y)
		w.pdf.SetY(y + 3)
	default: // div, li huérfano
		w.blocks(childList(n), align)
	}
}

// list dibuja ul/ol con sangría por nivel; las listas anidadas dentro de un li se recorren recursivamente.
func (w *pdfWriter) list(n *xhtml.Node, depth int) {
	idx := 0
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type != xhtml.ElementNode || c.DataAtom != atom.Li {
			continue
		}
		idx++
		marker := "• "
		if depth > 0 {
			marker = "- "
		}
		if n.DataAtom == atom.Ol {
			marker = fmt.Sprintf("%d. ", idx)
		}
		var runs []inlineRun
		var nested []*xhtml.Node
		for d := c.FirstChild; d != nil; d = d.NextSibling {
			if d.Type == xhtml.ElementNode && (d.DataAtom == atom.Ul || d.DataAtom == atom.Ol) {
				nested = append(nested, d)
				continue
			}
			runs = append(runs, collectInline(d, false, false, false)...)
		}
		prev := w.indent
		w.indent = prev + 4
		w.paragraph(append([]inlineRun{{text: marker}}, runs...), "", 5, 11, 0.5)
		for _, nl := range nested {
			w.list(nl, depth+1)
		}
		w.indent = prev
	}
}

func (w *pdfWriter) blocksChildren(n *xhtml.Node, align string) {
	hasBlock := false
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if c.Type == xhtml.ElementNode && isBlockAtom(c.DataAtom) {
			hasBlock = true
		}
	}
	if hasBlock {
		w.blocks(childList(n), align)
		return
	}
	w.paragraph(collectInline(n, false, false, false), align, 5, 11, 1.5)
}

func collectInline(n *xhtml.Node, bold, italic, under bool) []inlineRun {
	switch n.Type {
	case xhtml.TextNode:
		t := strings.Join(strings.Fields(n.Data), " ")
		if t == "" {
			if strings.TrimSpace(n.Data) == "" && n.Data != "" {
				return []inlineRun{{text: " ", bold: bold, italic: italic, under: under}}
			}
			return nil
		}
		if len(n.Data) > 0 && (n.Data[0] == ' ' || n.Data[0] == '\n') {
			t = " " + t
		}
		if last := n.Data[len(n.Data)-1]; last == ' ' || last == '\n' {
			t += " "
		}
		return []inlineRun{{text: t, bold: bold, italic: italic, under: under}}
	case xhtml.ElementNode:
		switch n.DataAtom {
		case atom.Br:
			return []inlineRun{{text: "\n"}}
		case atom.Strong, atom.B:
			bold = true
		case atom.Em, atom.I:
			italic = true
		case atom.U:
			under = true
		}
	}
	var out []inlineRun
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		out = append(out, collectInline(c, bold, italic, under)...)
	}
	return out
}

func runStyle(r inlineRun) string {
	s := ""
	if r.bold {
		s += "B"
	}
	if r.italic {
		s += "I"
	}
	if r.under {
		s += "U"
	}
	return s
}

// paragraph escribe runs; con alineación C/R/J usa MultiCell (estilo del primer run).
func (w *pdfWriter) paragraph(runs []inlineRun, align string, lineH, size, gap float64) {
	if len(runs) == 0 {
		return
	}
	var all strings.Builder
	for _, r := range runs {
		all.WriteString(r.text)
	}
	if strings.TrimSpace(all.String()) == "" {
		return
	}
	w.pdf.SetX(15 + w.indent)
	if align == "C" || align == "R" || align == "J" {
		w.pdf.SetFont("Arial", runStyle(runs[0]), size)
		w.pdf.MultiCell(180, lineH, w.txt(strings.TrimSpace(all.String())), "", align, false)
	} else {
		first := true
		for _, r := range runs {
			t := r.text
			if first {
				t = strings.TrimLeft(t, " ")
				if t == "" {
					continue
				}
				first = false
			}
			w.pdf.SetFont("Arial", runStyle(r), size)
			if t == "\n" {
				w.pdf.Ln(lineH)
				continue
			}
			w.pdf.Write(lineH, w.txt(t))
		}
		w.pdf.Ln(lineH)
	}
	w.pdf.SetFont("Arial", "", 11)
	w.pdf.Ln(gap)
}

func (w *pdfWriter) table(n *xhtml.Node) {
	type cell struct {
		text   string
		header bool
	}
	var rows [][]cell
	var walk func(*xhtml.Node)
	walk = func(x *xhtml.Node) {
		for c := x.FirstChild; c != nil; c = c.NextSibling {
			if c.Type != xhtml.ElementNode {
				continue
			}
			switch c.DataAtom {
			case atom.Tr:
				var row []cell
				for d := c.FirstChild; d != nil; d = d.NextSibling {
					if d.Type == xhtml.ElementNode && (d.DataAtom == atom.Td || d.DataAtom == atom.Th) {
						var sb strings.Builder
						for _, r := range collectInline(d, false, false, false) {
							sb.WriteString(r.text)
						}
						row = append(row, cell{strings.TrimSpace(sb.String()), d.DataAtom == atom.Th})
					}
				}
				if len(row) > 0 {
					rows = append(rows, row)
				}
			default:
				walk(c)
			}
		}
	}
	walk(n)
	if len(rows) == 0 {
		return
	}
	cols := 0
	for _, r := range rows {
		if len(r) > cols {
			cols = len(r)
		}
	}
	cw := 180.0 / float64(cols)
	w.pdf.SetDrawColor(148, 163, 184)
	for _, r := range rows {
		w.pdf.SetX(15)
		for _, c := range r {
			style := ""
			if c.header {
				style = "B"
				w.pdf.SetFillColor(241, 245, 249)
			}
			w.pdf.SetFont("Arial", style, 10)
			w.pdf.CellFormat(cw, 6, w.txt(TruncateTextToFit(w.pdf, c.text, cw, w.txt)), "1", 0, "L", c.header, 0, "")
		}
		w.pdf.Ln(6)
	}
	w.pdf.SetFont("Arial", "", 11)
	w.pdf.Ln(3)
}
