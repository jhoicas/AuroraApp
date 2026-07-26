---
name: go-backend-tenant
description: "Habilidad para desarrollar backend Go con Fiber y GORM en un SaaS multi-tenant. Garantiza que TODA consulta a PostgreSQL/Supabase respete aislamiento por tenant_id y RLS."
applyTo:
  - "starter/backend/**/*.go"
author: "GitHub Copilot"
---

# Habilidad go-backend-tenant

## Objetivo

Guiar la implementación y revisión de un backend en Go que use Fiber y GORM en un entorno SaaS multitenant, garantizando que cada consulta a la base de datos sea tenant-aware y nunca pueda eludir el aislamiento por `tenant_id`.

## Uso

Utiliza esta habilidad cuando trabajes en el backend Go de la aplicación, especialmente sobre consultas a PostgreSQL/Supabase y cuando necesites asegurar aislamiento de datos por cliente/tenant.

Incluye predicados como:
- `tenant_id`
- `RLS`
- `Supabase`
- `Fiber`
- `GORM`
- `multi-tenant`
- `seguridad de datos`
- `aislamiento de tenant`

## Reglas principales

1. Toda consulta a la base de datos debe incluir un filtro explícito sobre `tenant_id`.
2. El valor `tenant_id` debe derivarse de la solicitud HTTP a través de middleware, no de datos de entrada de la API sin validar.
3. El middleware debe enlazar el `tenant_id` al contexto de Fiber y a cada sesión de GORM.
4. Evita accesos directos a `DB.Raw(...)` o `Exec(...)` sin aplicar el filtro de tenant de forma correcta.
5. Prioriza el uso de Scope/Query builders de GORM y helpers centrales para garantizar consistencia.
6. Manejo de errores robusto: comprueba errores de base de datos, envía respuestas HTTP claras y no expongas datos internos.
7. En el backend de Supabase/PostgreSQL, recomienda también crear y validar políticas RLS que refuercen el aislamiento incluso si se elude la lógica de la aplicación.

## Recomendaciones de implementación

- Implementa un middleware Fiber que extraiga `tenant_id` de cabeceras seguras, JWT, subdominio o contexto de autenticación.
- Guarda el `tenant_id` en `c.Locals("tenant_id")` y úsalo en todos los handlers.
- Encapsula la creación de DB en una función o método que aplique siempre `db = db.Where("tenant_id = ?", tenantID)` antes de llamar a `Find`, `First`, `Create`, `Update`, `Delete` o `Exec`.
- Para consultas con relaciones, usa `Preload` o joins con el filtro de tenant.
- Para operaciones de escritura, asegúrate de que el payload no pueda contener un `tenant_id` distinto del actual.
- Cuando sea posible, inyecta un helper `TenantDB(db, tenantID)` que devuelva una instancia `*gorm.DB` encapsulada para ese tenant.

## IA y datos de contexto

- Usa el SDK de Anthropic (Claude Haiku) y prefiere Tool Calling para leer documentación relevante del workspace.
- Trata los archivos `.md` y `.xml` como una fuente de conocimiento estilo Obsidian vault.
- Antes de proponer cambios, revisa `docs/` y cualquier instrucción de arquitectura o modelo de datos disponible.
- No inventes detalles: usa lo que encuentres en los archivos del proyecto y documenta cualquier suposición.

## Calidad

- Prioriza código limpio, convención consistente y funciones pequeñas.
- Mantén la lógica de tenant en capas compartidas, no dispersa en cada endpoint.
- Asegura que los controles de acceso se puedan auditar fácilmente.
- Añade comentarios solo cuando mejoren la comprensión de la seguridad multitenant.

## Ejemplos de prompts

- `Implementa middleware tenant-aware para Fiber/GORM con aislamiento RLS`
- `Revisa las consultas de GORM y asegúrate de que todas usan tenant_id`
- `Genera un helper de DB que aplique tenant scope automáticamente`
- `Proporciona políticas RLS para Supabase/PostgreSQL basadas en tenant_id`
