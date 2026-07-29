package services

import (
	"encoding/xml"
	"fmt"
	"io"
	"regexp"
	"strings"

	"aurora-backend/internal/domain/models"
)

// ParsedNode nodo parseado con ID local antes de persistir en BD.
type ParsedNode struct {
	LocalID  string
	NodeType string
	Label    string
	Content  string
	Metadata map[string]string
}

// ParsedLink relación lógica entre nodos parseados.
type ParsedLink struct {
	SourceLocalID string
	TargetLocalID string
	Relationship  string
}

// MGAProjectGraph grafo semántico extraído del XML MGA.
type MGAProjectGraph struct {
	Meta  MGAProjectMeta
	Nodes []ParsedNode
	Links []ParsedLink
}

// MGAProjectMeta metadatos del proyecto extraídos del XML.
type MGAProjectMeta struct {
	ProjectKey  string
	ProjectName string
	Sector      string
	Phase       string
}

type graphBuilder struct {
	meta      MGAProjectMeta
	nodes     []ParsedNode
	links     []ParsedLink
	seq       int
	problemID string
	objective string
	altID     string
	productID string
}

func (b *graphBuilder) nextID(prefix string) string {
	b.seq++
	return fmt.Sprintf("%s-%d", prefix, b.seq)
}

func (b *graphBuilder) addNode(nodeType, label, content string, meta map[string]string) string {
	id := b.nextID(nodeType)
	b.nodes = append(b.nodes, ParsedNode{
		LocalID:  id,
		NodeType: nodeType,
		Label:    label,
		Content:  content,
		Metadata: meta,
	})
	return id
}

func (b *graphBuilder) link(source, target, rel string) {
	if source == "" || target == "" || source == target {
		return
	}
	b.links = append(b.links, ParsedLink{
		SourceLocalID: source,
		TargetLocalID: target,
		Relationship:  rel,
	})
}

// ParseMGAProjectXML extrae nodos y relaciones del XML MGA (ProjectSummary).
func ParseMGAProjectXML(r io.Reader, sourceFilename string) (MGAProjectMeta, MGAProjectGraph, error) {
	raw, err := io.ReadAll(r)
	if err != nil {
		return MGAProjectMeta{}, MGAProjectGraph{}, fmt.Errorf("read xml: %w", err)
	}

	b := &graphBuilder{
		meta: MGAProjectMeta{
			ProjectKey: slugProjectKey(sourceFilename),
			Phase:      "formulacion",
		},
	}

	dec := xml.NewDecoder(strings.NewReader(string(raw)))
	dec.CharsetReader = func(_ string, input io.Reader) (io.Reader, error) { return input, nil }

	var (
		projectID   string
		altCount    int
		prodCount   int
		actCount    int
		causeCount  int
		effectCount int
		objCount    int
		currentProb string
	)

	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return MGAProjectMeta{}, MGAProjectGraph{}, fmt.Errorf("parse xml token: %w", err)
		}

		se, ok := tok.(xml.StartElement)
		if !ok {
			continue
		}
		local := localName(se.Name.Local)

		switch local {
		case "ProjectName", "NombreProyecto", "Name":
			if b.meta.ProjectName == "" {
				b.meta.ProjectName = cleanText(readElementText(dec, se))
				if b.meta.ProjectKey == "" || b.meta.ProjectKey == "proyecto-mga" {
					b.meta.ProjectKey = slugProjectKey(b.meta.ProjectName)
				}
			}
		case "Sector", "SectorName":
			if b.meta.Sector == "" {
				b.meta.Sector = cleanText(readElementText(dec, se))
			}

		case "CentralProblem", "ProblemaCentral":
			probID, causeN, effectN := parseCentralProblemBlock(dec, se, b)
			if probID != "" {
				b.problemID = probID
				currentProb = probID
			}
			causeCount += causeN
			effectCount += effectN

		case "Cause", "Causa":
			text := cleanText(readElementText(dec, se))
			if text != "" {
				causeCount++
				cid := b.addNode(models.KnowledgeNodeCause, fmt.Sprintf("Causa %d", causeCount), text,
					map[string]string{"index": fmt.Sprintf("%d", causeCount), "phase": b.meta.Phase})
				parent := b.problemID
				if parent == "" {
					parent = projectID
				}
				if parent != "" {
					b.link(parent, cid, models.RelHasCause)
				}
			}

		case "Effect", "Efecto":
			text := cleanText(readElementText(dec, se))
			if text != "" {
				effectCount++
				eid := b.addNode(models.KnowledgeNodeEffect, fmt.Sprintf("Efecto %d", effectCount), text,
					map[string]string{"index": fmt.Sprintf("%d", effectCount), "phase": b.meta.Phase})
				parent := b.problemID
				if parent == "" {
					parent = projectID
				}
				if parent != "" {
					b.link(parent, eid, models.RelHasEffect)
				}
			}

		case "Causes", "Causas":
			parseContainerChildren(dec, se, func(text string) {
				causeCount++
				cid := b.addNode(models.KnowledgeNodeCause, fmt.Sprintf("Causa %d", causeCount), text,
					map[string]string{"index": fmt.Sprintf("%d", causeCount), "phase": b.meta.Phase})
				if b.problemID != "" {
					b.link(b.problemID, cid, models.RelHasCause)
				}
			}, "Cause", "Causa")

		case "Effects", "Efectos":
			parseContainerChildren(dec, se, func(text string) {
				effectCount++
				eid := b.addNode(models.KnowledgeNodeEffect, fmt.Sprintf("Efecto %d", effectCount), text,
					map[string]string{"index": fmt.Sprintf("%d", effectCount), "phase": b.meta.Phase})
				if b.problemID != "" {
					b.link(b.problemID, eid, models.RelHasEffect)
				}
			}, "Effect", "Efecto")

		case "SpecificObjective", "ObjetivoEspecifico":
			text := cleanText(readElementText(dec, se))
			if text != "" {
				objCount++
				oid := b.addNode(models.KnowledgeNodeSpecificObjective, fmt.Sprintf("Objetivo específico %d", objCount), text,
					map[string]string{"index": fmt.Sprintf("%d", objCount), "phase": b.meta.Phase})
				b.objective = oid
				if projectID != "" {
					b.link(projectID, oid, models.RelHasObjective)
				}
			}

		case "GeneralObjective", "ObjetivoGeneral":
			text := cleanText(readElementText(dec, se))
			if text != "" {
				objCount++
				oid := b.addNode(models.KnowledgeNodeSpecificObjective, "Objetivo general", text,
					map[string]string{"phase": b.meta.Phase, "legacy": "general_objective"})
				b.objective = oid
				if projectID != "" {
					b.link(projectID, oid, models.RelHasObjective)
				}
			}

		case "SpecificObjectives", "ObjetivosEspecificos":
			parseContainerChildren(dec, se, func(text string) {
				objCount++
				oid := b.addNode(models.KnowledgeNodeSpecificObjective, fmt.Sprintf("Objetivo específico %d", objCount), text,
					map[string]string{"index": fmt.Sprintf("%d", objCount), "phase": b.meta.Phase})
				b.objective = oid
				if projectID != "" {
					b.link(projectID, oid, models.RelHasObjective)
				}
			}, "SpecificObjective", "ObjetivoEspecifico")

		case "Alternative", "Alternativa":
			text := cleanText(readElementText(dec, se))
			if text != "" {
				altCount++
				aid := b.addNode(models.KnowledgeNodeAlternative, fmt.Sprintf("Alternativa %d", altCount), text,
					map[string]string{"index": fmt.Sprintf("%d", altCount), "phase": b.meta.Phase})
				b.altID = aid
				parent := b.objective
				if parent == "" {
					parent = projectID
				}
				if parent != "" {
					b.link(parent, aid, models.RelHasAlternative)
				}
			}

		case "Product", "Producto":
			text := cleanText(readElementText(dec, se))
			if text != "" {
				prodCount++
				pid := b.addNode(models.KnowledgeNodeProduct, fmt.Sprintf("Producto %d", prodCount), text,
					map[string]string{"index": fmt.Sprintf("%d", prodCount), "phase": b.meta.Phase})
				b.productID = pid
				parent := b.altID
				if parent == "" {
					parent = b.objective
				}
				if parent == "" {
					parent = projectID
				}
				if parent != "" {
					b.link(parent, pid, models.RelHasProduct)
				}
			}

		case "Activity", "Actividad":
			text := cleanText(readElementText(dec, se))
			if text != "" {
				actCount++
				actID := b.addNode(models.KnowledgeNodeActivity, fmt.Sprintf("Actividad %d", actCount), text,
					map[string]string{"index": fmt.Sprintf("%d", actCount), "phase": b.meta.Phase})
				parent := b.productID
				if parent == "" {
					parent = b.altID
				}
				if parent == "" {
					parent = projectID
				}
				if parent != "" {
					b.link(parent, actID, models.RelHasActivity)
				}
			}

		case "Alternatives", "Alternativas":
			parseContainerChildren(dec, se, func(text string) {
				altCount++
				aid := b.addNode(models.KnowledgeNodeAlternative, fmt.Sprintf("Alternativa %d", altCount), text,
					map[string]string{"index": fmt.Sprintf("%d", altCount), "phase": b.meta.Phase})
				b.altID = aid
				parent := b.objective
				if parent == "" {
					parent = projectID
				}
				if parent != "" {
					b.link(parent, aid, models.RelHasAlternative)
				}
			}, "Alternative", "Alternativa")

		case "Products", "Productos":
			parseContainerChildren(dec, se, func(text string) {
				prodCount++
				pid := b.addNode(models.KnowledgeNodeProduct, fmt.Sprintf("Producto %d", prodCount), text,
					map[string]string{"index": fmt.Sprintf("%d", prodCount), "phase": b.meta.Phase})
				b.productID = pid
				parent := b.altID
				if parent == "" {
					parent = b.objective
				}
				if parent != "" {
					b.link(parent, pid, models.RelHasProduct)
				}
			}, "Product", "Producto")

		case "Activities", "Actividades":
			parseContainerChildren(dec, se, func(text string) {
				actCount++
				actID := b.addNode(models.KnowledgeNodeActivity, fmt.Sprintf("Actividad %d", actCount), text,
					map[string]string{"index": fmt.Sprintf("%d", actCount), "phase": b.meta.Phase})
				parent := b.productID
				if parent == "" {
					parent = b.altID
				}
				if parent != "" {
					b.link(parent, actID, models.RelHasActivity)
				}
			}, "Activity", "Actividad")

		case "Description", "Descripcion":
			_ = cleanText(readElementText(dec, se))
		}

		_ = currentProb
	}

	if b.meta.ProjectName == "" {
		b.meta.ProjectName = strings.TrimSuffix(sourceFilename, ".xml")
	}
	if b.meta.ProjectKey == "" {
		b.meta.ProjectKey = slugProjectKey(b.meta.ProjectName)
	}

	// Nodo raíz del proyecto.
	projectID = b.addNode(models.KnowledgeNodeProject, b.meta.ProjectName,
		fmt.Sprintf("Proyecto MGA: %s", b.meta.ProjectName),
		map[string]string{"sector": b.meta.Sector, "phase": b.meta.Phase, "source": sourceFilename})

	// Re-enlazar nodos huérfanos que dependían de projectID durante el parseo.
	for i := range b.nodes {
		n := &b.nodes[i]
		if n.LocalID == projectID {
			continue
		}
		switch n.NodeType {
		case models.KnowledgeNodeCentralProblem:
			b.link(projectID, n.LocalID, models.RelHasProblem)
		case models.KnowledgeNodeSpecificObjective:
			if !hasLinkTo(b.links, projectID, n.LocalID) {
				b.link(projectID, n.LocalID, models.RelHasObjective)
			}
		case models.KnowledgeNodeCause, models.KnowledgeNodeEffect:
			if b.problemID != "" && !hasLinkTo(b.links, b.problemID, n.LocalID) {
				rel := models.RelHasCause
				if n.NodeType == models.KnowledgeNodeEffect {
					rel = models.RelHasEffect
				}
				b.link(b.problemID, n.LocalID, rel)
			}
		case models.KnowledgeNodeAlternative:
			if b.objective != "" && !hasLinkTo(b.links, b.objective, n.LocalID) {
				b.link(b.objective, n.LocalID, models.RelHasAlternative)
			} else if !hasLinkTo(b.links, projectID, n.LocalID) {
				b.link(projectID, n.LocalID, models.RelHasAlternative)
			}
		case models.KnowledgeNodeProduct:
			if b.altID != "" && !hasLinkTo(b.links, b.altID, n.LocalID) {
				b.link(b.altID, n.LocalID, models.RelHasProduct)
			}
		case models.KnowledgeNodeActivity:
			if b.productID != "" && !hasLinkTo(b.links, b.productID, n.LocalID) {
				b.link(b.productID, n.LocalID, models.RelHasActivity)
			}
		}
	}

	// Mover nodo project al inicio.
	projectNode := b.nodes[len(b.nodes)-1]
	b.nodes = append([]ParsedNode{projectNode}, b.nodes[:len(b.nodes)-1]...)

	if len(b.nodes) <= 1 {
		return b.meta, MGAProjectGraph{}, fmt.Errorf("no se encontraron nodos MGA reconocibles en el XML")
	}

	graph := MGAProjectGraph{
		Meta:  b.meta,
		Nodes: b.nodes,
		Links: b.links,
	}
	return b.meta, graph, nil
}

func parseCentralProblemBlock(dec *xml.Decoder, parent xml.StartElement, b *graphBuilder) (problemID string, causes, effects int) {
	depth := 1
	var descParts []string
	var causeTexts, effectTexts []string

	for depth > 0 {
		tok, err := dec.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.CharData:
			if depth == 1 {
				text := cleanText(string(t))
				if text != "" {
					descParts = append(descParts, text)
				}
			}
		case xml.StartElement:
			depth++
			local := localName(t.Name.Local)
			switch local {
			case "Description", "Descripcion":
				text := cleanText(readElementText(dec, t))
				if text != "" {
					descParts = append(descParts, text)
				}
				depth--
			case "Cause", "Causa":
				text := cleanText(readElementText(dec, t))
				if text != "" {
					causeTexts = append(causeTexts, text)
				}
				depth--
			case "Effect", "Efecto":
				text := cleanText(readElementText(dec, t))
				if text != "" {
					effectTexts = append(effectTexts, text)
				}
				depth--
			case "Causes", "Causas":
				parseContainerChildren(dec, t, func(text string) {
					causeTexts = append(causeTexts, text)
				}, "Cause", "Causa")
				depth--
			case "Effects", "Efectos":
				parseContainerChildren(dec, t, func(text string) {
					effectTexts = append(effectTexts, text)
				}, "Effect", "Efecto")
				depth--
			default:
				inner := cleanText(readElementText(dec, t))
				if inner != "" {
					descParts = append(descParts, inner)
				}
				depth--
			}
		case xml.EndElement:
			if t.Name.Local == parent.Name.Local && t.Name.Space == parent.Name.Space {
				goto done
			}
			depth--
		}
	}
done:

	content := cleanText(strings.Join(descParts, " "))
	if content != "" {
		problemID = b.addNode(models.KnowledgeNodeCentralProblem, "Problema central", content,
			map[string]string{"phase": b.meta.Phase})
	}

	for _, text := range causeTexts {
		causes++
		cid := b.addNode(models.KnowledgeNodeCause, fmt.Sprintf("Causa %d", causes), text,
			map[string]string{"index": fmt.Sprintf("%d", causes), "phase": b.meta.Phase})
		if problemID != "" {
			b.link(problemID, cid, models.RelHasCause)
		}
	}
	for _, text := range effectTexts {
		effects++
		eid := b.addNode(models.KnowledgeNodeEffect, fmt.Sprintf("Efecto %d", effects), text,
			map[string]string{"index": fmt.Sprintf("%d", effects), "phase": b.meta.Phase})
		if problemID != "" {
			b.link(problemID, eid, models.RelHasEffect)
		}
	}
	return problemID, causes, effects
}

func hasLinkTo(links []ParsedLink, source, target string) bool {
	for _, l := range links {
		if l.SourceLocalID == source && l.TargetLocalID == target {
			return true
		}
	}
	return false
}

func parseContainerChildren(dec *xml.Decoder, parent xml.StartElement, onChild func(string), childNames ...string) {
	allowed := make(map[string]struct{}, len(childNames))
	for _, n := range childNames {
		allowed[n] = struct{}{}
	}
	depth := 1
	for depth > 0 {
		tok, err := dec.Token()
		if err != nil {
			return
		}
		switch t := tok.(type) {
		case xml.StartElement:
			depth++
			if depth == 2 {
				if _, ok := allowed[localName(t.Name.Local)]; ok {
					text := cleanText(readElementText(dec, t))
					if text != "" {
						onChild(text)
					}
					depth--
				}
			}
		case xml.EndElement:
			if t.Name.Local == parent.Name.Local && t.Name.Space == parent.Name.Space {
				return
			}
			depth--
		}
	}
}

func readElementText(dec *xml.Decoder, start xml.StartElement) string {
	var b strings.Builder
	depth := 1
	for depth > 0 {
		tok, err := dec.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.CharData:
			b.Write(t)
		case xml.StartElement:
			depth++
			inner := readElementText(dec, t)
			b.WriteString(inner)
			depth--
		case xml.EndElement:
			if t.Name.Local == start.Name.Local && t.Name.Space == start.Name.Space {
				return b.String()
			}
			depth--
		}
	}
	return b.String()
}

func localName(name string) string {
	if idx := strings.Index(name, ":"); idx >= 0 {
		return name[idx+1:]
	}
	return name
}

var spaceRe = regexp.MustCompile(`\s+`)

func cleanText(s string) string {
	s = strings.TrimSpace(s)
	s = spaceRe.ReplaceAllString(s, " ")
	return s
}

func slugProjectKey(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	name = strings.TrimSuffix(name, ".xml")
	repl := regexp.MustCompile(`[^a-z0-9]+`)
	name = repl.ReplaceAllString(name, "-")
	name = strings.Trim(name, "-")
	if name == "" {
		return "proyecto-mga"
	}
	if len(name) > 120 {
		return name[:120]
	}
	return name
}
