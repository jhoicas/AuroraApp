package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	_ "github.com/jackc/pgx/v5/stdlib"
)

type FormulateRequest struct {
	Query string `json:"query"`
}

type toolCall struct {
	Action string                 `json:"action"`
	Tool   string                 `json:"tool,omitempty"`
	Args   map[string]interface{} `json:"args,omitempty"`
	Text   string                 `json:"text,omitempty"`
}

const SystemPrompt = `Eres 'Aurora', una Asistente Experta en Formulación de Proyectos de Inversión Pública en Colombia, impulsada por el motor Aurora.
Debes responder siempre en formato Markdown con un tono empático, directo y profesional.

Reglas estrictas:
- Usa OBLIGATORIAMENTE las herramientas list_wiki_notes, read_note y query_catalogo cuando el usuario pregunte por leyes, manuales, normativas, tipologías MGA o catálogos oficiales.
- Si el usuario define el problema central como "falta de una solución", corrige esa formulación y reescribe el problema en términos de necesidad técnica, alcance de inversión y resultados esperados.
- Exige verbos fuertes como Incrementar, Construir, Optimizar, Fortalecer, Asegurar, Formalizar.
- Prohibe verbos débiles como Propender, Apoyar, Facilitar, Permitir, Considerar.
- Si la propuesta corresponde a Tipología A, es obligatorio usar EDT y proponer al menos 2 entregables de Nivel 1.
- Siempre prioriza el uso de datos institucionales y catálogos oficiales; no inventes códigos ni detalles.
- Cuando necesites contexto del vault o del catálogo, responde con una acción de herramienta en formato JSON: {"action":"call","tool":"<tool_name>","args":{...}}.
- Solo emite la respuesta final cuando tengas suficiente contexto completo: {"action":"final","text":"..."}.
`

func queryCatalogoDB(db *sql.DB, sectorID, programaID string) (string, error) {
	// Simple crosswalk: return first 5 products matching program codes
	rows, err := db.Query(`SELECT codigo_producto, producto FROM public.catalogo_productos WHERE codigo_programa=$1 LIMIT 5`, programaID)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	var out []map[string]string
	for rows.Next() {
		var code, name string
		rows.Scan(&code, &name)
		out = append(out, map[string]string{"code": code, "name": name})
	}
	b, _ := json.Marshal(out)
	return string(b), nil
}

func FormulateProjectAI(c *fiber.Ctx) error {
	var req FormulateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	query := strings.TrimSpace(req.Query)
	if query == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Query is required"})
	}

	tenantID, _ := c.Locals("tenant_id").(string)

	// Prepare initial prompt instructing Claude how to call tools
	system := SystemPrompt

	// Loop to allow model request tool calls (simple tool-calling emulation)
	var lastResp string
	var history strings.Builder
	db, err := openDB()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	defer db.Close()

	for i := 0; i < 3; i++ {
		prompt := history.String() + "User: " + query + "\n"
		log.Printf("AI loop iteration %d prompt:\n%s", i+1, prompt)
		modelOut, err := callAnthropic(system, prompt)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		log.Printf("Anthropic output: %s", modelOut)

		var tc toolCall
		if err := json.Unmarshal([]byte(modelOut), &tc); err != nil {
			return c.JSON(fiber.Map{"message": "AI formulation response", "response": modelOut})
		}

		if tc.Action == "final" {
			log.Printf("Final model response: %s", tc.Text)
			return c.JSON(fiber.Map{"message": "AI formulation response", "response": tc.Text})
		}

		if tc.Action != "call" {
			log.Printf("Unknown action received: %s", tc.Action)
			return c.JSON(fiber.Map{"message": "AI formulation response", "response": modelOut})
		}

		var toolResult string
		switch tc.Tool {
		case "list_wiki_notes":
			rows, err := db.Query(`SELECT title FROM public.knowledge_wiki_notes WHERE tenant_id=$1 ORDER BY updated_at DESC`, tenantID)
			if err != nil {
				toolResult = fmt.Sprintf("error: %v", err)
			} else {
				defer rows.Close()
				var titles []string
				for rows.Next() {
					var t string
					rows.Scan(&t)
					titles = append(titles, t)
				}
				b, _ := json.Marshal(titles)
				toolResult = string(b)
			}
		case "read_note":
			title, _ := tc.Args["title"].(string)
			var content string
			err := db.QueryRow(`SELECT content FROM public.knowledge_wiki_notes WHERE tenant_id=$1 AND title=$2`, tenantID, title).Scan(&content)
			if err != nil {
				toolResult = fmt.Sprintf("error: %v", err)
			} else {
				toolResult = content
			}
		case "query_catalogo":
			sectorID, _ := tc.Args["sector_id"].(string)
			programaID, _ := tc.Args["programa_id"].(string)
			res, err := queryCatalogoDB(db, sectorID, programaID)
			if err != nil {
				toolResult = fmt.Sprintf("error: %v", err)
			} else {
				toolResult = res
			}
		default:
			toolResult = fmt.Sprintf("unknown tool: %s", tc.Tool)
		}

		argsJSON, _ := json.Marshal(tc.Args)
		history.WriteString(fmt.Sprintf("Assistant: {\"action\":\"call\",\"tool\":\"%s\",\"args\":%s}\n", tc.Tool, string(argsJSON)))
		history.WriteString(fmt.Sprintf("ToolResult: %s\n", toolResult))
		log.Printf("Tool executed: %s args=%v result=%s", tc.Tool, tc.Args, toolResult)
		lastResp = toolResult
	}

	if lastResp != "" {
		return c.JSON(fiber.Map{"message": "AI formulation response", "response": lastResp})
	}
	return c.JSON(fiber.Map{"message": "AI formulation response", "response": "No response produced"})
}
