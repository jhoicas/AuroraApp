# AI_CHANGELOG

Registro compartido de cambios realizados por GitHub Copilot, Cursor y Antigravity.

## Instrucciones obligatorias

- Toda IA debe leer este archivo antes de proponer o ejecutar cambios.
- Toda IA debe agregar una entrada al finalizar una sesion que haya modificado el repositorio.
- No se deben borrar ni reescribir entradas historicas. Agrega siempre la entrada mas reciente al inicio de la seccion `## Registro`.
- Describe hechos verificables: archivos, decisiones, comportamiento, dependencias y validaciones.
- Si hubo cambios concurrentes, conflictos, validaciones omitidas o riesgos pendientes, declaralos explicitamente.
- Usa una entrada por sesion y conserva el formato de la plantilla.

## Registro

<!-- Las IAs agregan nuevas entradas inmediatamente debajo de este comentario. -->

### 2026-09-16 - Antigravity - Validación obligatoria de campos MGA

- **Objetivo:** Hacer obligatorios los campos de proyecto MGA (Proceso, Objeto, Localizaciones, Tipo de inversión, Tipología, Sector, Producto).
- **Archivos modificados:**
  - `starter/backend/internal/interfaces/http/dto/project_dto.go` - Agregados campos MGA con tag `binding:"required"`.
  - `starter/frontend/src/store/projectStore.ts` - Agregados campos MGA al payload.
  - `starter/frontend/src/store/auroraCopilotStore.ts` - Agregados campos MGA al `CreationContext`.
  - `starter/frontend/src/components/Tenant/CreateProjectModal.tsx` - Validación de campos obligatorios en el submit y tag `required`.
  - `starter/frontend/src/pages/tenant/ProjectCreationAssistant.tsx` - Validación obligatoria antes de iniciar la entrevista MGA.
- **Logica implementada:**
  - Los endpoints de backend validarán la presencia estricta de estos campos.
  - El frontend bloqueará los flujos (Modal manual y Asistente IA) si faltan los campos clave.
- **Dependencias:**
  - Ninguna
- **Validacion ejecutada:**
  - Revisión estática de código; se implementó el binding requerido en Fiber DTOs.
- **Decisiones ADR:**
  - No aplica
- **Riesgos y pendientes:**
  - Ninguno
### 2026-09-16 - Copilot - Base de alineacion multi-IA

- **Objetivo:** Preparar AuroraApp para trabajo concurrente y trazable entre GitHub Copilot, Cursor y Antigravity.
- **Archivos modificados:**
  - `.cursorrules` - reglas maestras para Cursor y flujo compartido.
  - `AI_CHANGELOG.md` - registro y plantilla obligatoria de sesiones.
  - `docs/kb/GO_STANDARDS.md` - estandares de arquitectura, errores y testing en Go.
  - `docs/kb/REACT_SUPABASE_STANDARDS.md` - estandares de React, TypeScript, Supabase y RLS.
  - `docs/kb/BUSINESS_LOGIC.md` - invariantes MGA, multi-tenancy y cambios de esquema.
  - `docs/adr/0000-template.md` - plantilla de decisiones arquitectonicas.
  - `.agents/skills/workspace-alignment/SKILL.md` - workflow autonomo de alineacion.
  - `.agents/skills/workspace-alignment/CHANGELOG.md` - historial del skill.
- **Logica implementada:** Reglas de lectura previa, coordinacion entre asistentes, aislamiento por tenant, trazabilidad de decisiones y validacion enfocada.
- **Dependencias:** Ninguna.
- **Validacion ejecutada:**
  - Verificacion PowerShell de las 8 rutas, frontmatter, marcadores de plantilla y `git diff --check` - correcta.
- **Decisiones ADR:** No aplica; se creo solo una plantilla reutilizable.
- **Riesgos y pendientes:** Las politicas RLS concretas deben seguir verificandose contra cada migracion y entorno de Supabase.

### YYYY-MM-DD - [Copilot|Cursor|Antigravity] - [Resumen breve]

- **Objetivo:** [Que se intento resolver]
- **Archivos modificados:**
  - `[ruta]` - [cambio realizado]
- **Logica implementada:**
  - [Reglas de negocio, flujo o comportamiento afectado]
- **Dependencias:**
  - [Dependencias agregadas, actualizadas o: Ninguna]
- **Validacion ejecutada:**
  - `[comando]` - [resultado]
- **Decisiones ADR:**
  - [ADR creado/actualizado o: No aplica]
- **Riesgos y pendientes:**
  - [Riesgos conocidos, conflictos o: Ninguno]
