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

Cuando sugieras correcciones gramaticales, redacciones de objetivos/causas/efectos o códigos de catálogo,
incluye al final un bloque JSON EXACTO con este formato (sin markdown extra):

` + "```aurora-actions\n" + `{"action_cards":[{"type":"mga_apply","label":"✨ Aplicar este objetivo","payload":{"field":"general_objective","value":"Mejorar la cobertura de acueducto rural en el municipio"}}]}
` + "```" + `

Tipos de tarjeta ("type"):
- "mga_apply": aplica texto sugerido a un campo MGA. payload.field puede ser:
  general_objective, problem_description, specific_objective (requiere payload.relation_id),
  effect_description (requiere payload.effect_id).
  payload.value es el texto final sugerido.
- "catalog_search": busca en catálogo DNP. Requiere catalog y code.
  Valores válidos para catalog: ods, products, sectors, programs, edt, deliverables, activities.
- "navigate": abre una ruta. payload.path con la URL interna (ej. /tenant/catalog).

Ejemplo catálogo:
{"action_cards":[{"type":"catalog_search","catalog":"ods","code":"6.1","label":"✨ Ver ODS 6.1","description":"Agua limpia"}]}

Si no hay acciones sugeridas, omite el bloque aurora-actions.
Nunca menciones OpenAI. Solo Anthropic Claude alimenta este asistente.`

var auroraActionsBlock = regexp.MustCompile("(?s)```aurora-actions\\s*(\\{.*?\\})\\s*```")
var jsonActionCards = regexp.MustCompile(`(?s)"action_cards"\s*:\s*\[`)

var validCatalogTypes = map[string]struct{}{
	"ods": {}, "products": {}, "sectors": {}, "programs": {},
	"edt": {}, "deliverables": {}, "activities": {},
}

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
	case strings.Contains(r, "mga:identificacion:causas-efectos"):
		return "El usuario está en Identificación MGA — Causas y Efectos del árbol de problemas."
	case strings.Contains(r, "mga:project-creation"):
		return "El usuario está en la entrevista de creación asistida de proyecto MGA."
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
			return reply, validateActionCards(envelope.ActionCards)
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
	return validateActionCards(payload.ActionCards)
}

func validateActionCards(cards []dto.ActionCard) []dto.ActionCard {
	out := make([]dto.ActionCard, 0, len(cards))
	for _, c := range cards {
		if normalized, ok := normalizeActionCard(c); ok {
			out = append(out, normalized)
		}
	}
	return out
}

func normalizeActionCard(c dto.ActionCard) (dto.ActionCard, bool) {
	c.Type = strings.ToLower(strings.TrimSpace(c.Type))
	c.Catalog = strings.ToLower(strings.TrimSpace(c.Catalog))
	c.Code = strings.TrimSpace(c.Code)
	c.Label = strings.TrimSpace(c.Label)
	c.Description = strings.TrimSpace(c.Description)

	if c.Type == "" {
		if c.Catalog != "" && c.Code != "" && c.Label != "" {
			c.Type = "catalog_search"
		} else {
			return c, false
		}
	}

	switch c.Type {
	case "mga_apply":
		if c.Label == "" || c.Payload == nil {
			return c, false
		}
		field, _ := c.Payload["field"].(string)
		value, _ := c.Payload["value"].(string)
		field = strings.TrimSpace(field)
		value = strings.TrimSpace(value)
		if field == "" {
			return c, false
		}
		switch field {
		case "add_cause":
			if value == "" {
				return c, false
			}
			causeType, _ := c.Payload["cause_type"].(string)
			causeType = strings.ToLower(strings.TrimSpace(causeType))
			if causeType != "directa" && causeType != "indirecta" {
				return c, false
			}
			c.Payload["field"] = field
			c.Payload["value"] = value
			c.Payload["cause_type"] = causeType
			if parentID, ok := c.Payload["parent_id"].(string); ok {
				c.Payload["parent_id"] = strings.TrimSpace(parentID)
			}
			return c, true
		case "add_effect":
			if value == "" {
				return c, false
			}
			effectType, _ := c.Payload["effect_type"].(string)
			effectType = strings.ToLower(strings.TrimSpace(effectType))
			if effectType != "directo" && effectType != "indirecto" {
				return c, false
			}
			c.Payload["field"] = field
			c.Payload["value"] = value
			c.Payload["effect_type"] = effectType
			if parentID, ok := c.Payload["parent_id"].(string); ok {
				c.Payload["parent_id"] = strings.TrimSpace(parentID)
			}
			return c, true
		default:
			if value == "" {
				return c, false
			}
			c.Payload["field"] = field
			c.Payload["value"] = value
			return c, true
		}

	case "catalog_search":
		if c.Label == "" || c.Catalog == "" || c.Code == "" {
			return c, false
		}
		if _, ok := validCatalogTypes[c.Catalog]; !ok {
			return c, false
		}
		return c, true

	case "navigate":
		if c.Label == "" {
			return c, false
		}
		if c.Payload == nil {
			c.Payload = map[string]interface{}{}
		}
		if path, ok := c.Payload["path"].(string); ok {
			c.Payload["path"] = strings.TrimSpace(path)
		}
		return c, true

	case "mga_generate_project":
		if c.Label == "" || c.Payload == nil {
			return c, false
		}
		name, _ := c.Payload["name"].(string)
		problemDesc, _ := c.Payload["problem_description"].(string)
		generalObj, _ := c.Payload["general_objective"].(string)
		name = strings.TrimSpace(name)
		problemDesc = strings.TrimSpace(problemDesc)
		generalObj = strings.TrimSpace(generalObj)
		if name == "" || problemDesc == "" || generalObj == "" {
			return c, false
		}
		causes := payloadStringSlice(c.Payload, "causes")
		effects := payloadStringSlice(c.Payload, "effects")
		if len(causes) < 2 || len(effects) < 2 {
			return c, false
		}
		c.Payload["name"] = name
		c.Payload["problem_description"] = problemDesc
		c.Payload["general_objective"] = generalObj
		c.Payload["causes"] = causes
		c.Payload["effects"] = effects
		return c, true

	default:
		return c, false
	}
}

func payloadStringSlice(payload map[string]interface{}, key string) []string {
	raw, ok := payload[key]
	if !ok || raw == nil {
		return nil
	}

	var items []string
	switch v := raw.(type) {
	case []string:
		items = v
	case []interface{}:
		for _, item := range v {
			if s, ok := item.(string); ok {
				items = append(items, s)
			}
		}
	default:
		return nil
	}

	seen := make(map[string]struct{}, len(items))
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if _, dup := seen[item]; dup {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}
