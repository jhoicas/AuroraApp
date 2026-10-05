# Esquema de base de datos

## Fuente de verdad

- `docs/schema.sql` y `docs/schema-antigravity.sql` son los scripts SQL disponibles en el repositorio.
- Cuando ambos scripts difieren, no se debe inferir una tabla o columna: se debe consultar la migracion o el modelo Go correspondiente.
- Este documento describe solo relaciones verificadas en esos scripts.

## Aislamiento multitenant

- `tenants.id` es la clave primaria del tenant.
- `users.tenant_id` referencia `tenants.id` y puede ser nulo para el usuario especial que no pertenezca a un tenant.
- `proyectos.tenant_id` referencia `tenants.id` y es obligatorio.
- `sectores.tenant_id` referencia `tenants.id`; un valor nulo representa un catalogo global cuando lo permiten las politicas RLS.
- En `schema-antigravity.sql`, las tablas `programas_subprogramas`, `catalogo_productos`, `catalogo_edt`, `lista_entregables`, `lista_actividades`, `ods` y `knowledge_wiki_notes` tambien tienen `tenant_id`.
- Las politicas RLS usan el tenant del JWT (`public.tenant_id()` o `public.current_tenant_id()`, segun el script). Nunca se debe aceptar un `tenant_id` del cliente sin validarlo.

## Usuarios, tenants y proyectos

- `users.tenant_id -> tenants.id`: un tenant puede tener muchos usuarios.
- `proyectos.tenant_id -> tenants.id`: un tenant puede tener muchos proyectos.
- `proyectos.creador_id -> users.id`: un usuario puede crear muchos proyectos.
- `proyectos.sector_id -> sectores.id` y `proyectos.producto_principal_id -> productos.id`.
- El nombre oficial del proyecto en los scripts disponibles es `proyectos`, no `projects`.
- `proyectos.codigo_bpin` almacena el codigo BPIN cuando esta disponible.

## Catalogos y jerarquias verificadas

- `sectores -> programas -> subprogramas -> productos` mediante `sector_id`, `programa_id` y `subprograma_id`.
- `edt.producto_id -> productos.id` en `schema.sql`.
- `schema-antigravity.sql` usa catalogos alternativos o consolidados: `programas_subprogramas`, `catalogo_productos` y `catalogo_edt`.
- `regiones -> departamentos -> municipios` mediante `region_id` y `departamento_id`.
- `procesos` y `regiones` son catalogos MGA globales; `departamentos` y `municipios` dependen de ellos.
- Las tablas con prefijo `catalogo_` son catalogos maestros en `schema-antigravity.sql`. No todas las tablas de catalogo tienen ese prefijo en `schema.sql` (`sectores`, `programas`, `subprogramas`, `productos`, `ods`, `edt`, `procesos`, `regiones`, `departamentos`, `municipios`).

## Tablas MGA, EDT e IA solicitadas

Los siguientes nombres aparecen en el requerimiento funcional, pero no estan declarados en los dos scripts SQL disponibles y por tanto no se documentan como tablas existentes:

- `projects` y sus columnas `mga_formulation_data` y `fase_maduracion`.
- `mga_causes`, `mga_effects`, `mga_participants`, `mga_populations`, `mga_alternatives`.
- `mga_specific_objectives`, `mga_indicators`, `project_edt_nodes`, `project_deliverables`, `project_activities`.
- `budget_items`, `project_evaluations`, `ai_knowledge_nodes`, `ai_chat_messages`, `ai_usage_logs`.

La relacion funcional esperada para esas entidades puede usarse como requisito de dominio, pero no como contrato de persistencia hasta que exista una migracion o un script oficial que la declare.

## Base de conocimiento existente

- `knowledge_wiki_notes.tenant_id -> tenants.id`.
- La nota es unica por tenant y titulo mediante `unique_tenant_note`.
- Su contenido es texto y esta protegido por RLS para que cada tenant consulte y modifique solo sus notas.

## Reglas para agentes

1. Verifica primero el nombre real de la tabla y sus columnas en el SQL, migraciones o modelos.
2. Aplica el aislamiento por tenant en consultas, escrituras, joins y relaciones.
3. No mezcles las dos variantes del esquema sin identificar cual script o migracion se esta ejecutando.
4. Si una tarea requiere una entidad marcada como ausente arriba, solicita o crea primero la migracion aprobada; no improvises el modelo.
