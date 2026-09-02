package ai

import (
	"fmt"
	"strings"
)

// RouteContextMgaCausesEffects identifica la asistencia Aurora en Causas y Efectos (Modo MGA).
const RouteContextMgaCausesEffects = "mga:identificacion:causas-efectos"

// MgaCausesEffectsEmptyRAGMessage respuesta fija cuando no hay nodos cause/effect en el KG global.
const MgaCausesEffectsEmptyRAGMessage = "No hay datos históricos suficientes en el Knowledge Graph para sugerir causas o efectos."

// IsMgaCausesEffectsRoute indica si el contexto de ruta corresponde a causas/efectos MGA.
func IsMgaCausesEffectsRoute(routeContext string) bool {
	return strings.TrimSpace(routeContext) == RouteContextMgaCausesEffects
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
