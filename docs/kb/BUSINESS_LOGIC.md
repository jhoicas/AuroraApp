# Logica de Negocio y Esquemas

## Principios de dominio

- AuroraApp gestiona proyectos de inversion publica bajo una estructura MGA: identificacion, preparacion, evaluacion, programacion y seguimiento segun el alcance implementado.
- Conserva las invariantes del dominio: un proyecto pertenece a un tenant, sus usuarios operan con roles explicitos y las transiciones de estado deben ser validas y auditables.
- Distingue catalogos globales del Estado de catalogos especificos del tenant. `tenant_id` nulo solo significa global cuando el modelo y la politica RLS lo permiten explicitamente.
- La IA Aurora asiste, recomienda y valida; no sustituye la autoridad del usuario ni confirma automaticamente decisiones con impacto presupuestal, normativo o de permisos.
- Toda recomendacion generada por IA debe poder rastrearse a su entrada, contexto, usuario, resultado y accion aceptada o rechazada.

## Cambios de esquema

- Antes de cambiar tablas, relaciones, enums, funciones, vistas, indices o politicas, revisa `docs/schema.sql`, `docs/schema-antigravity.sql` y las migraciones aplicables.
- Mantiene nombres, claves foraneas, restricciones, timestamps y semantica de `tenant_id` compatibles con los consumidores existentes.
- Cada cambio de esquema debe incluir migracion, politicas RLS, grants necesarios, estrategia de compatibilidad y pruebas de regresion.
- No resuelvas problemas de autorizacion eliminando RLS, ampliando grants indiscriminadamente o aceptando ids de tenant enviados por el cliente sin verificarlos.
- Usa ADR para decisiones que cambien contratos, limites de dominio, estrategia de persistencia, proveedor de IA o modelo de seguridad.

## Cambios de logica

- Localiza reglas en servicios/casos de uso de dominio y expresa sus invariantes en tests; no las dupliques en React, handlers y SQL.
- Respeta roles `SUPER_ADMIN`, `TENANT_ADMIN`, `FORMULADOR`, `EVALUADOR`, `ANALISTA` y `VIEWER`, aplicando minimo privilegio.
- Las operaciones financieras, evaluaciones y aprobaciones deben ser deterministas, auditables y resistentes a reintentos.
- Las importaciones de catalogos deben validar codigos, duplicados, referencias y alcance territorial antes de persistir.
- Ante ambiguedad funcional, conserva el comportamiento existente, documenta el supuesto en `AI_CHANGELOG.md` y solicita una decision antes de romper compatibilidad.
