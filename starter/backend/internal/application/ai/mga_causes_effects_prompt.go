package ai

import (
	"fmt"
	"strings"
)

// RouteContextMgaCausesEffects identifica la asistencia Aurora en Causas y Efectos (Modo MGA).
const RouteContextMgaCausesEffects = "mga:identificacion:causas-efectos"

// RouteContextMgaSituacionExistente identifica asistencia para situación existente.
const RouteContextMgaSituacionExistente = "mga:identificacion:situacion-existente"

// RouteContextMgaMagnitudProblema identifica asistencia para magnitud del problema.
const RouteContextMgaMagnitudProblema = "mga:identificacion:magnitud-problema"

// MgaIdentificationEmptyRAGMessage respuesta fija cuando el KG global no aporta contexto.
const MgaIdentificationEmptyRAGMessage = "No hay datos históricos suficientes en el Knowledge Graph para sugerir redacción de este campo."

// MgaCausesEffectsEmptyRAGMessage respuesta fija cuando no hay nodos cause/effect en el KG global.
const MgaCausesEffectsEmptyRAGMessage = "No hay datos históricos suficientes en el Knowledge Graph para sugerir causas o efectos."

// IsMgaCausesEffectsRoute indica si el contexto de ruta corresponde a causas/efectos MGA.
func IsMgaCausesEffectsRoute(routeContext string) bool {
	return strings.TrimSpace(routeContext) == RouteContextMgaCausesEffects
}

// IsMgaSituacionExistenteRoute indica asistencia para situación existente.
func IsMgaSituacionExistenteRoute(routeContext string) bool {
	return strings.TrimSpace(routeContext) == RouteContextMgaSituacionExistente
}

// IsMgaMagnitudProblemaRoute indica asistencia para magnitud del problema.
func IsMgaMagnitudProblemaRoute(routeContext string) bool {
	return strings.TrimSpace(routeContext) == RouteContextMgaMagnitudProblema
}

// IsMgaIdentificationKgRoute agrupa rutas MGA de identificación con RAG estricto del KG global.
func IsMgaIdentificationKgRoute(routeContext string) bool {
	return IsMgaCausesEffectsRoute(routeContext) ||
		IsMgaSituacionExistenteRoute(routeContext) ||
		IsMgaMagnitudProblemaRoute(routeContext)
}

// BuildMgaCausesEffectsRAGQuery concatena los campos de identificación para el embedding RAG.
func BuildMgaCausesEffectsRAGQuery(problemDescription, situacionExistente, magnitudProblema, userMessage string) string {
	parts := make([]string, 0, 4)
	for _, p := range []string{problemDescription, situacionExistente, magnitudProblema, userMessage} {
		if t := strings.TrimSpace(p); t != "" {
			parts = append(parts, t)
		}
	}
	return strings.Join(parts, "\n\n")
}

// BuildMgaCausesEffectsSystemPrompt genera el system prompt estricto (solo Knowledge Graph global).
func BuildMgaCausesEffectsSystemPrompt(ragContext string) string {
	rag := strings.TrimSpace(ragContext)
	if rag == "" {
		rag = "(vacío — no sugieras nada)"
	}

	return fmt.Sprintf(`Eres Aurora, asistente de formulación MGA en la sección de Causas y Efectos.

REGLA ABSOLUTA: Toda sugerencia DEBE basarse ÚNICA Y EXCLUSIVAMENTE en el Knowledge Graph provisto abajo.
- Solo puedes sugerir causas (node_type=cause) y efectos (node_type=effect) que aparezcan en el bloque RAG.
- PROHIBIDO inventar, parafrasear libremente o extrapolar causas/efectos que no estén en el RAG.
- Si el contexto RAG está vacío, responde exactamente: "%s" y NO generes bloque aurora-actions ni JSON.

Contexto del Knowledge Graph (causas y efectos históricos indexados):
%s

Instrucciones de salida:
1. Resume brevemente las causas y efectos sugeribles del RAG (máx. 6 ítems).
2. Incluye action cards mga_apply para aplicar cada sugerencia al árbol del proyecto.

Formato de action cards (bloque aurora-actions):
`+"```aurora-actions"+`
{
  "action_cards": [
    {
      "type": "mga_apply",
      "label": "✨ Aplicar causa directa",
      "description": "Texto breve",
      "payload": {
        "field": "add_cause",
        "value": "Descripción textual EXACTA del nodo RAG",
        "cause_type": "directa",
        "parent_id": ""
      }
    },
    {
      "type": "mga_apply",
      "label": "✨ Aplicar efecto indirecto",
      "payload": {
        "field": "add_effect",
        "value": "Descripción textual EXACTA del nodo RAG",
        "effect_type": "indirecto",
        "parent_id": "<uuid del efecto directo padre si aplica>"
      }
    }
  ]
}
`+"```"+`

Valores permitidos:
- cause_type: "directa" o "indirecta" (indirecta requiere parent_id de causa directa existente)
- effect_type: "directo" o "indirecto" (indirecto requiere parent_id de efecto directo existente)
- parent_id: UUID string o vacío para nodos directos

Responde en español.`, MgaCausesEffectsEmptyRAGMessage, rag)
}

// BuildMgaSituacionExistenteSystemPrompt genera prompt estricto para situación existente.
func BuildMgaSituacionExistenteSystemPrompt(ragContext string) string {
	return buildMgaIdentificationFieldPrompt(
		"Descripción de la situación existente",
		"situacion_existente",
		ragContext,
	)
}

// BuildMgaMagnitudProblemaSystemPrompt genera prompt estricto para magnitud del problema.
func BuildMgaMagnitudProblemaSystemPrompt(ragContext string) string {
	return buildMgaIdentificationFieldPrompt(
		"Magnitud actual del problema e indicadores de referencia",
		"magnitud_problema",
		ragContext,
	)
}

func buildMgaIdentificationFieldPrompt(fieldLabel, fieldKey, ragContext string) string {
	rag := strings.TrimSpace(ragContext)
	if rag == "" {
		rag = "(vacío — no sugieras nada)"
	}

	return fmt.Sprintf(`Eres Aurora, asistente de formulación MGA en Identificación del problema.

REGLA ABSOLUTA: Toda sugerencia DEBE basarse ÚNICA Y EXCLUSIVAMENTE en el Knowledge Graph global provisto abajo.
- PROHIBIDO inventar ejemplos o métricas que no estén respaldadas por el RAG.
- Si el contexto RAG está vacío, responde exactamente: "%s" y NO generes bloque aurora-actions ni JSON.

Campo objetivo: %s

Contexto del Knowledge Graph (proyectos históricos indexados):
%s

Instrucciones de salida:
1. Redacta una propuesta estructurada basada solo en el RAG.
2. Incluye una action card mga_apply para aplicar el texto sugerido.

Formato de action card:
`+"```aurora-actions"+`
{
  "action_cards": [
    {
      "type": "mga_apply",
      "label": "✨ Aplicar redacción sugerida",
      "description": "Texto breve",
      "payload": {
        "field": "%s",
        "value": "Texto sugerido basado en el RAG"
      }
    }
  ]
}
`+"```"+`

Responde en español.`, MgaIdentificationEmptyRAGMessage, fieldLabel, rag, fieldKey)
}
