package ai

import (
	"fmt"
	"strings"
)

// ─── Constantes de la entrevista de ideación ────────────────────────

const (
	// RouteContextIdeationInterview identifica el chat de ideación pre-creación.
	RouteContextIdeationInterview = "mga:ideation-interview"

	// ContextCompleteKeyword señal emitida por el LLM cuando la información
	// mínima de la entrevista ya fue recopilada.
	ContextCompleteKeyword = "[CONTEXTO_COMPLETO]"

	// MaxIdeationTurns máximo de intercambios usuario↔asistente.
	// Al alcanzar este límite el LLM está obligado a cerrar la entrevista.
	MaxIdeationTurns = 4

	// IdeationCompleteDefaultReply mensaje por defecto cuando el LLM emite
	// [CONTEXTO_COMPLETO] sin texto adicional.
	IdeationCompleteDefaultReply = "¡Perfecto! Ya tengo la información necesaria para estructurar tu proyecto. Voy a generar las sugerencias para el formulario."

	// Decreto1278AuditRulesPrompt sección del system prompt para la exigencia de anexos
	// obligatorios según el Decreto 1278 de 2023 del Valle del Cauca.
	Decreto1278AuditRulesPrompt = `### REGLAS DE AUDITORÍA Y ANEXOS LOCALES (DECRETO 1278 VALLE DEL CAUCA) ###
Como asesor experto en inversión pública, debes evaluar continuamente la naturaleza del proyecto que el usuario describe. Si detectas alguna de las siguientes tipologías, debes advertirle de manera amable pero firme, antes de finalizar la ideación, sobre los anexos documentales obligatorios que debe ir preparando:
1. PROYECTOS TECNOLÓGICOS / TIC: Si el proyecto involucra software, hardware, conectividad o tecnología, adviértele que es obligatorio tramitar y adjuntar el 'Concepto Técnico favorable de la Secretaría de las Tecnologías de la Información y las Comunicaciones (TIC)'.
2. COMUNIDADES ÉTNICAS: Si el proyecto va dirigido a o afecta a comunidades Indígenas, Afrocolombianas, Raizales o Palenqueras, exígele tener el 'Certificado de alineación con el respectivo Plan de Etnodesarrollo o Plan de Vida de la comunidad', y el acta de consulta previa si aplica.
3. INFRAESTRUCTURA FÍSICA: Si el proyecto implica construcción, remodelación o adecuación de obras civiles, recuérdale que el SGFT exigirá 'Estudios y diseños técnicos actualizados y aprobados', así como el 'Certificado de titularidad del predio' a nombre de la entidad pública.`
)

// IsIdeationInterviewRoute indica si el contexto de ruta corresponde a la
// entrevista de ideación pre-creación de proyecto.
func IsIdeationInterviewRoute(routeContext string) bool {
	return strings.TrimSpace(routeContext) == RouteContextIdeationInterview
}

// BuildIdeationInterviewSystemPrompt construye el system prompt de la
// entrevista adaptativa MGA. turnNumber indica el turno actual (1-based);
// cuando alcanza MaxIdeationTurns, el LLM es forzado a cerrar.
func BuildIdeationInterviewSystemPrompt(ragContext string, turnNumber int) string {
	var b strings.Builder

	b.WriteString(`Eres un asesor experto en formulación de proyectos de inversión pública bajo la Metodología General Ajustada (MGA) de Colombia.

Tu misión es evaluar el contexto proporcionado por el usuario para determinar si tiene la información mínima necesaria para estructurar un proyecto. Necesitas identificar tres dimensiones clave:
1) El problema central o necesidad que motiva el proyecto.
2) La ubicación geográfica donde se ejecutará (departamento, municipio o vereda).
3) La posible solución o tipo de intervención propuesta.

REGLAS ESTRICTAS:
- Si falta información vital sobre alguna de las 3 dimensiones anteriores, haz UNA SOLA pregunta breve, clara y conversacional para obtener lo que falta. No hagas más de una pregunta por turno.
- Si el contexto ya es suficiente y claro con las 3 dimensiones cubiertas, emite la palabra clave ` + "`[CONTEXTO_COMPLETO]`" + ` (puedes acompañarla de un breve mensaje de cierre y las advertencias de anexos correspondientes si aplican).
- Sé conciso y empático. No repitas información que el usuario ya proporcionó.
- Responde siempre en español.
- No inventes datos. No asumas ubicaciones ni soluciones que el usuario no haya mencionado.

` + Decreto1278AuditRulesPrompt + `
`)

	if turnNumber >= MaxIdeationTurns {
		b.WriteString(fmt.Sprintf(`
INSTRUCCIÓN FINAL OBLIGATORIA (turno %d de %d — último permitido):
DEBES emitir la palabra clave `+"`[CONTEXTO_COMPLETO]`"+` para cerrar la entrevista (puedes incluir las advertencias de anexos del Decreto 1278 si la tipología del proyecto lo requiere). El usuario podrá completar los datos faltantes manualmente en el formulario. No hagas más preguntas.
`, turnNumber, MaxIdeationTurns))
	} else {
		b.WriteString(fmt.Sprintf("\nTurno actual: %d de %d.\n", turnNumber, MaxIdeationTurns))
	}

	rag := strings.TrimSpace(ragContext)
	if rag != "" {
		b.WriteString(`
CONTEXTO DE PROYECTOS SIMILARES (Knowledge Graph):
Usa los siguientes proyectos históricos como referencia para formular mejores preguntas y orientar al usuario:

`)
		b.WriteString(rag)
		b.WriteString("\n")
	}

	return b.String()
}

// BuildSuggestProjectSetupPrompt construye el prompt del LLM para generar
// sugerencias de formulario a partir del historial de ideación y contexto RAG.
func BuildSuggestProjectSetupPrompt(conversationContext, ragContext, currentFormData string) string {
	var b strings.Builder

	b.WriteString(`Eres Aurora, asistente experta en la Metodología General Ajustada (MGA) de Colombia.

Con base en la siguiente conversación de ideación del usuario, genera sugerencias concretas para los campos del formulario de creación del proyecto de inversión pública.

CONVERSACIÓN DEL USUARIO:
`)
	b.WriteString(conversationContext)
	b.WriteString("\n\n")

	rag := strings.TrimSpace(ragContext)
	if rag != "" {
		b.WriteString("PROYECTOS SIMILARES DEL KNOWLEDGE GRAPH (úsalos como referencia):\n")
		b.WriteString(rag)
		b.WriteString("\n\n")
	}

	cfd := strings.TrimSpace(currentFormData)
	if cfd != "" && cfd != "{}" {
		b.WriteString("[DATOS_ACTUALES_FORMULARIO]:\n")
		b.WriteString("Ten muy en cuenta lo que el usuario ya ha escrito o seleccionado a continuación. Las sugerencias de los demás campos DEBEN alinearse coherentemente con esta información:\n")
		b.WriteString(cfd)
		b.WriteString("\n\n")
	}

	b.WriteString(`INSTRUCCIONES:
Responde ÚNICAMENTE con un bloque JSON válido (sin texto adicional, sin markdown, sin backticks) con esta estructura exacta, generando 2 o 3 opciones para cada campo basándote en la información dada:
{
  "nombre": ["Opción 1 de nombre del proyecto", "Opción 2 de nombre del proyecto"],
  "proceso": ["Construcción", "Dotación"],
  "objeto": ["Opción 1 de objeto a entregar", "Opción 2 de objeto a entregar"],
  "localizaciones": [
     [{"departamento": "Nombre del depto 1", "municipio": "Nombre del mun 1"}],
     [{"departamento": "Nombre del depto 2", "municipio": "Nombre del mun 2"}]
  ],
  "sector_sugerido": ["Educación", "Salud y Protección Social"],
  "producto_principal": ["Producto asociado opción 1", "Producto asociado opción 2"]
}

REGLAS:
- Para el campo 'proceso', devuelve ÚNICAMENTE el nombre descriptivo en texto (ej. 'Construcción', 'Dotación', 'Adquisición'). NUNCA devuelvas el código numérico.
- Para el campo 'localizaciones', devuelve una lista de listas. Cada lista interna representa una opción de ubicaciones (puede tener una o más ubicaciones).
- No inventes ubicaciones ni datos que el usuario no haya mencionado.
- El objeto debe ser claro, conciso y seguir el estándar MGA de redacción (mínimo 10, máximo 200 caracteres).
- Basa tus sugerencias exclusivamente en la información real proporcionada por el usuario o en los [DATOS_ACTUALES_FORMULARIO].
- Si algún campo no puede determinarse con certeza, déjalo como lista vacía [].`)

	return b.String()
}

// IsContextComplete detecta si la respuesta del LLM contiene la señal de
// cierre de entrevista.
func IsContextComplete(llmReply string) bool {
	return strings.Contains(llmReply, ContextCompleteKeyword)
}

// CleanContextCompleteKeyword elimina la señal de cierre de la respuesta
// y devuelve el texto restante (o un mensaje por defecto si queda vacío).
func CleanContextCompleteKeyword(reply string) string {
	cleaned := strings.ReplaceAll(reply, ContextCompleteKeyword, "")
	cleaned = strings.TrimSpace(cleaned)
	if cleaned == "" {
		return IdeationCompleteDefaultReply
	}
	return cleaned
}
