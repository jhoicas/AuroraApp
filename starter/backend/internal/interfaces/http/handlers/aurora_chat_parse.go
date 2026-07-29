package handlers

import (
	"encoding/json"
	"regexp"
	"strings"

	"aurora-backend/internal/interfaces/http/dto"
)

const auroraSystemPrompt = `Eres Aurora, una experta en la Metodología General Ajustada (MGA) de Colombia.
Guías a formuladores de proyectos de inversión pública de forma sencilla, empática y precisa.
Responde siempre en español.

Cuando el usuario necesite un código de catálogo (ODS, producto DNP, sector, programa, EDT, entregable o actividad),
incluye al final de tu respuesta un bloque JSON EXACTO con este formato (sin markdown extra):

` + "```aurora-actions\n" + `{"action_cards":[{"catalog":"ods","code":"1.1","label":"Fin de la pobreza","description":"Breve explicación"}]}
` + "```" + `

Valores válidos para "catalog": ods, products, sectors, programs, edt, deliverables, activities.
Si no hay sugerencias de catálogo, omite el bloque aurora-actions.
Nunca menciones OpenAI. Solo Anthropic Claude alimenta este asistente.`

var auroraActionsBlock = regexp.MustCompile("(?s)```aurora-actions\\s*(\\{.*?\\})\\s*```")
var jsonActionCards = regexp.MustCompile(`(?s)"action_cards"\s*:\s*\[`)

func buildAuroraSystemPrompt(routeContext, ragContext string) string {
	var b strings.Builder
	b.WriteString(auroraSystemPrompt)
	b.WriteString("\n\n")
	if routeContext = strings.TrimSpace(routeContext); routeContext != "" {
		b.WriteString("Contexto de navegación: ")
		b.WriteString(describeRoute(routeContext))
		b.WriteString("\n")
	}
	if ragContext = strings.TrimSpace(ragContext); ragContext != "" {
		b.WriteString("\nConocimiento MGA indexado (RAG):\n")
		b.WriteString(ragContext)
	}
	return b.String()
}

func describeRoute(route string) string {
	r := strings.ToLower(route)
	switch {
	case strings.Contains(r, "/catalogs/ods"):
		return "El usuario está en el Catálogo de ODS."
	case strings.Contains(r, "/catalogs/products"):
		return "El usuario está en el Catálogo de Productos DNP."
	case strings.Contains(r, "/catalogs/sectors"):
		return "El usuario está en el Catálogo de Sectores."
	case strings.Contains(r, "/catalogs/programs"):
		return "El usuario está en el Catálogo de Programas."
	case strings.Contains(r, "/catalogs/edt"), strings.Contains(r, "/catalogs/indicators"):
		return "El usuario está en el Catálogo EDT."
	case strings.Contains(r, "/catalogs/deliverables"), strings.Contains(r, "/catalogs/funding"):
		return "El usuario está en el Catálogo de Entregables."
	case strings.Contains(r, "/catalogs/activities"):
		return "El usuario está en la Lista de Actividades."
	case strings.Contains(r, "/admin/ai"):
		return "El usuario está en la Gestión IA / Knowledge Base MGA."
	case strings.Contains(r, "/admin/tenants"):
		return "El usuario está en la Gestión de Tenants."
	default:
		return "El usuario navega la plataforma AuroraApp (" + route + ")."
	}
}

func parseAuroraResponse(raw string) (reply string, cards []dto.ActionCard) {
	raw = strings.TrimSpace(raw)
	cards = []dto.ActionCard{}

	if m := auroraActionsBlock.FindStringSubmatch(raw); len(m) == 2 {
		reply = strings.TrimSpace(auroraActionsBlock.ReplaceAllString(raw, ""))
		cards = extractActionCards(m[1])
		return reply, cards
	}

	if strings.HasPrefix(raw, "{") {
		var envelope struct {
			Reply       string           `json:"reply"`
			ActionCards []dto.ActionCard `json:"action_cards"`
		}
		if err := json.Unmarshal([]byte(raw), &envelope); err == nil {
			reply = strings.TrimSpace(envelope.Reply)
			if reply == "" {
				reply = raw
			}
			return reply, envelope.ActionCards
		}
	}

	if jsonActionCards.MatchString(raw) {
		start := strings.Index(raw, "{")
		end := strings.LastIndex(raw, "}")
		if start >= 0 && end > start {
			fragment := raw[start : end+1]
			cards = extractActionCards(fragment)
			reply = strings.TrimSpace(raw[:start])
		}
	}

	if reply == "" {
		reply = raw
	}
	return reply, cards
}

func extractActionCards(jsonFragment string) []dto.ActionCard {
	var payload struct {
		ActionCards []dto.ActionCard `json:"action_cards"`
	}
	if err := json.Unmarshal([]byte(jsonFragment), &payload); err != nil {
		return nil
	}
	out := make([]dto.ActionCard, 0, len(payload.ActionCards))
	for _, c := range payload.ActionCards {
		c.Catalog = strings.ToLower(strings.TrimSpace(c.Catalog))
		c.Code = strings.TrimSpace(c.Code)
		c.Label = strings.TrimSpace(c.Label)
		if c.Catalog != "" && c.Code != "" {
			out = append(out, c)
		}
	}
	return out
}
