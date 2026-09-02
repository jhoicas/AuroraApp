package ai

import (
	"fmt"
	"strings"
)

// RouteContextMgaProjectCreation identifica la entrevista asistida de creación de proyecto MGA.
const RouteContextMgaProjectCreation = "mga:project-creation"

// ProjectCreationDegradedRAGNote nota inyectada cuando el KG global no aporta ejemplos históricos.
const ProjectCreationDegradedRAGNote = "No se encontraron proyectos históricos similares, básate en la metodología estándar MGA."

// IsMgaProjectCreationRoute indica si el contexto de ruta corresponde a la entrevista de creación.
func IsMgaProjectCreationRoute(routeContext string) bool {
	return strings.TrimSpace(routeContext) == RouteContextMgaProjectCreation
}

// BuildProjectCreationRAGQuery concatena idea, catálogos y mensaje para el embedding RAG.
func BuildProjectCreationRAGQuery(
	ideaSummary, sectorCode, sectorName string,
	productCodes, programCodes, odsCodes []string,
	userMessage string,
) string {
	parts := make([]string, 0, 8)
	for _, p := range []string{ideaSummary, sectorCode, sectorName, userMessage} {
		if t := strings.TrimSpace(p); t != "" {
			parts = append(parts, t)
		}
	}
	for _, codes := range [][]string{productCodes, programCodes, odsCodes} {
		for _, c := range codes {
			if t := strings.TrimSpace(c); t != "" {
				parts = append(parts, t)
			}
		}
	}
	return strings.Join(parts, "\n\n")
}

// BuildProjectCreationSystemPrompt genera el system prompt de entrevista iterativa.
// Si ragContext está vacío, activa modo degradado (metodología MGA estándar, sin bloque KG).
func BuildProjectCreationSystemPrompt(ragContext, catalogSummary string) string {
	rag := strings.TrimSpace(ragContext)
	catalog := strings.TrimSpace(catalogSummary)

	var b strings.Builder
	b.WriteString(`Eres Aurora, asistente experta en la Metodología General Ajustada (MGA) de Colombia.
Conduces una entrevista guiada para ayudar al formulador a definir un nuevo proyecto de inversión pública.

REGLAS DE LA ENTREVISTA:
1. Haz como máximo 1-2 preguntas cortas por turno.
2. Debes recopilar progresivamente:
   - Problema central del proyecto
   - Objetivo general
   - Al menos 2 causas directas del árbol de problemas
   - Al menos 2 efectos directos del árbol de problemas
3. Cuando la información mínima esté completa, resume lo recopilado y sugiere generar el proyecto con una action card mga_generate_project.

`)

	if catalog != "" {
		b.WriteString("Contexto de catálogos preseleccionados por el usuario:\n")
		b.WriteString(catalog)
		b.WriteString("\n\n")
	}

	if rag != "" {
		b.WriteString(`GUÍA CON KNOWLEDGE GRAPH:
- Basa tus preguntas y ejemplos en los proyectos históricos del bloque RAG provisto.
- Puedes referenciar patrones de formulación similares del KG para orientar al usuario.

Contexto del Knowledge Graph (proyectos históricos indexados):
`)
		b.WriteString(rag)
		b.WriteString("\n\n")
	} else {
		b.WriteString("MODO DEGRADADO:\n")
		b.WriteString(ProjectCreationDegradedRAGNote)
		b.WriteString(`
- Formula preguntas según la metodología estándar MGA (DNP).
- No inventes datos cuantitativos ni códigos de catálogo no confirmados por el usuario.

`)
	}

	b.WriteString(`FORMATO DE SALIDA (cuando la entrevista esté completa):
Incluye un bloque aurora-actions con type "mga_generate_project":

` + "```aurora-actions" + `
{
  "action_cards": [
    {
      "type": "mga_generate_project",
      "label": "✨ Generar proyecto MGA",
      "description": "Crear borrador con la información recopilada",
      "payload": {
        "name": "Nombre corto del proyecto",
        "problem_description": "Descripción del problema central",
        "general_objective": "Objetivo general formulado",
        "causes": ["Causa directa 1", "Causa directa 2"],
        "effects": ["Efecto directo 1", "Efecto directo 2"],
        "sector": "código sector opcional",
        "product_code": "código producto opcional"
      }
    }
  ]
}
` + "```" + `

Responde siempre en español.`)

	return b.String()
}

// FormatCreationCatalogSummary resume el contexto de creación para el system prompt.
func FormatCreationCatalogSummary(
	ideaSummary, sectorCode, sectorName string,
	productCodes, programCodes, odsCodes []string,
) string {
	var lines []string
	if t := strings.TrimSpace(ideaSummary); t != "" {
		lines = append(lines, fmt.Sprintf("- Idea inicial: %s", t))
	}
	if t := strings.TrimSpace(sectorName); t != "" {
		lines = append(lines, fmt.Sprintf("- Sector: %s", t))
	} else if t := strings.TrimSpace(sectorCode); t != "" {
		lines = append(lines, fmt.Sprintf("- Sector (código): %s", t))
	}
	if len(productCodes) > 0 {
		lines = append(lines, fmt.Sprintf("- Productos: %s", strings.Join(productCodes, ", ")))
	}
	if len(programCodes) > 0 {
		lines = append(lines, fmt.Sprintf("- Programas: %s", strings.Join(programCodes, ", ")))
	}
	if len(odsCodes) > 0 {
		lines = append(lines, fmt.Sprintf("- ODS: %s", strings.Join(odsCodes, ", ")))
	}
	return strings.Join(lines, "\n")
}
