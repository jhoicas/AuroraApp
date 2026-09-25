## 2026-09-20: Ideación Dinámica y Sugerencias RAG
- **Backend**: Se implementó IdeationHandler con /api/v1/ai/ideation/chat (entrevista de hasta 4 turnos) y /api/v1/ai/ideation/suggest.
- **Backend**: Se actualizó CreateProjectRequest para aceptar MgaFormulationData y guardar el contexto inicial en JSONB.
- **Frontend**: Se migró CreateProjectModal de un asistente estático a una interfaz de chat interactiva usando ideationMessages.
- **Frontend**: Se actualizó uroraCopilotStore.ts con estado de ideación interactivo y transiciones de estado.

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

### 2026-09-25 - Antigravity - Incorporación de la Variable "Fase de Maduración" (Perfil, Prefactibilidad, Factibilidad)

- **Objetivo:** Incorporar la variable "Fase de Maduración" al proceso de creación y estructuración de proyectos MGA, capturándola desde la interfaz de usuario (Wizard de Ideación y formulario manual) y transmitiéndola como contexto al backend y al System Prompt del Asistente de IA para regular su nivel de rigor presupuestal y técnico.
- **Backend (Go):**
  - `starter/backend/internal/domain/models/project.go`:
    - Agregado el campo `FaseMaduracion string` con mapeo GORM `column:fase_maduracion;type:varchar(50);default:'PERFIL'` y serialización JSON `fase_maduracion`.
  - `starter/backend/internal/infrastructure/persistence/postgres/db.go`:
    - Actualizado `ensureProjectsSchema` para agregar la columna `fase_maduracion VARCHAR(50) DEFAULT 'PERFIL'` tanto en el DDL inicial como en la migración idempotente `ALTER TABLE`.
  - `starter/backend/internal/interfaces/http/dto/project_dto.go`:
    - Agregado `FaseMaduracion string` a `CreateProjectRequest`, `PatchProjectRequest` y `ProjectResponse`.
  - `starter/backend/internal/interfaces/http/dto/ideation_dto.go`:
    - Agregado `FaseMaduracion string json:"fase_maduracion,omitempty"` a `IdeationChatRequest`.
  - `starter/backend/internal/interfaces/http/dto/aurora_chat_dto.go`:
    - Agregado `FaseMaduracion string json:"fase_maduracion,omitempty"` a `AuroraChatCreationContext`.
  - `starter/backend/internal/interfaces/http/handlers/project_handler.go`:
    - Mapeo y persistencia de `FaseMaduracion` en `Create`, `Patch` y respuesta `toProjectResponse`.
  - `starter/backend/internal/application/ai/ideation_interview_prompt.go`:
    - Actualizado `BuildIdeationInterviewSystemPrompt` para recibir `faseMaduracion ...string` e inyectar la regla dinámica:
      `Si el proyecto está en fase de "Perfil", permite estimaciones presupuestales aproximadas. Si está en fase de "Factibilidad", exige rigor absoluto, mencionando que se requieren diseños y presupuestos de obra detallados ítem por ítem en la cadena de valor.`
  - `starter/backend/internal/application/ai/project_creation_prompt.go`:
    - Actualizado `BuildProjectCreationSystemPrompt` y `FormatCreationCatalogSummary` para reflejar la fase de maduración en el prompt y el resumen de catálogos.
  - `starter/backend/internal/interfaces/http/handlers/ideation_handler.go` & `aurora_chat_handler.go`:
    - Propagación de `FaseMaduracion` desde las peticiones HTTP hacia los prompts del LLM.
  - `starter/backend/internal/application/ai/ideation_interview_prompt_test.go`:
    - Añadidas pruebas unitarias `TestBuildIdeationInterviewSystemPrompt_FaseMaduracion` cubriendo las distintas fases y el comportamiento predeterminado.
- **Frontend (React / TypeScript):**
  - `starter/frontend/src/store/projectStore.ts`:
    - Añadido `fase_maduracion?: string` a las interfaces `Project` y `CreateProjectPayload`, propagándolo en el body de `createProject`.
  - `starter/frontend/src/store/auroraCopilotStore.ts`:
    - Añadido `ideationFaseMaduracion: string` y su acción `setIdeationFaseMaduracion(fase: string)`.
    - Actualizado `sendIdeationMessage(message, faseMaduracion?)` para enviar `fase_maduracion` en el body hacia `/ai/ideation/chat`.
    - Añadido `faseMaduracion` a `CreationContext` y a `mapCreationContextToApi`.
  - `starter/frontend/src/components/Tenant/CreateProjectModal.tsx`:
    - En modo Wizard (`step === 'wizard'`): Integrado selector interactivo de fase en la cabecera del chat con tres opciones ('Perfil', 'Prefactibilidad', 'Factibilidad') y descripciones del nivel de rigor correspondiente.
    - En modo Formulario (`step === 'form'`): Integrado selector desplegable de Fase de Maduración.
    - Sincronización y persistencia tanto en creación como en edición de proyectos MGA.
  - `starter/frontend/src/pages/tenant/ProjectCreationAssistant.tsx`:
    - Añadido selector de "Fase de Maduración" en el panel lateral de contexto y soporte de prop `preselectedFaseMaduracion`.
  - `starter/frontend/src/lib/auroraActionDispatcher.ts`:
    - Incluido `fase_maduracion` al generar proyectos desde action cards `mga_generate_project`.
- **Validación ejecutada:**
  - `cd starter/frontend && npx tsc --noEmit` -> Exit Code 0.
  - `cd starter/backend && go build ./...` -> Exit Code 0.
  - `cd starter/backend && go test ./...` -> Exit Code 0 (100% de tests passing).


### 2026-09-25 - Antigravity - Integración de Reglas de Auditoría y Anexos del Decreto 1278 en el Asistente de Ideación

- **Objetivo:** Enseñar al Asesor Conversacional de IA (Asistente de Ideación) a evaluar continuamente la naturaleza del proyecto y advertir proactivamente sobre los anexos documentales obligatorios exigidos por el Decreto 1278 de 2023 del Valle del Cauca (TIC, Comunidades Étnicas e Infraestructura Física) antes de finalizar la ideación.
- **Backend (Go):**
  - `starter/backend/internal/application/ai/ideation_interview_prompt.go`:
    - Definida la constante `Decreto1278AuditRulesPrompt` con la sección delimitada `### REGLAS DE AUDITORÍA Y ANEXOS LOCALES (DECRETO 1278 VALLE DEL CAUCA) ###` y las 3 tipologías exactas:
      1. **Proyectos Tecnológicos / TIC**: Concepto Técnico favorable de la Secretaría TIC.
      2. **Comunidades Étnicas**: Certificado de alineación con el Plan de Etnodesarrollo / Plan de Vida y acta de consulta previa si aplica.
      3. **Infraestructura Física**: Estudios y diseños técnicos actualizados y aprobados + Certificado de titularidad del predio a nombre de la entidad pública.
    - Actualizado `BuildIdeationInterviewSystemPrompt` para inyectar estas reglas manteniendo la fluidez conversacional y permitiendo emitir la señal `[CONTEXTO_COMPLETO]` acompañada de las advertencias pertinentes.
  - `starter/backend/internal/application/ai/project_creation_prompt.go`:
    - Inyectado `Decreto1278AuditRulesPrompt` en `BuildProjectCreationSystemPrompt` para mantener consistencia en cualquier variante del asistente de creación de proyectos.
  - `starter/backend/internal/application/ai/ideation_interview_prompt_test.go` [NUEVO]:
    - Creada suite de pruebas unitarias verificando la inclusión obligatoria de la sección del Decreto 1278 y las 3 tipologías, gestión de turnos, integración con RAG y preservación de advertencias al limpiar `[CONTEXTO_COMPLETO]`.
- **Validación ejecutada:**
  - `cd starter/backend && go test -v ./internal/application/ai/...` -> 100% PASS (Exit Code 0).
  - `cd starter/backend && go test -v ./internal/application/...` -> 100% PASS (Exit Code 0).
  - `cd starter/backend && go build ./...` -> Exit Code 0.

### 2026-09-25 - Antigravity - Refactorización y Potenciación del Simulacro de Auditoría Previa (Validador Estricto MGA)

- **Objetivo:** Refactorizar el "Simulacro de Auditoría Previa" para convertirlo en un validador híbrido y estricto de requisitos mínimos de la Metodología General Ajustada (MGA - Colombia), evitando devoluciones formales ante el Banco de Programas y Proyectos de Inversión Pública (DNP / Gobernaciones).
- **Backend (Go):**
  - `starter/backend/internal/interfaces/http/dto/formulation_audit_dto.go`:
    - Creado `AuditFinding` con campos: `ID` (string), `Message` (string), `Severity` ("CRITICAL" | "WARNING" | "SUCCESS"), `SectionKey` (string con tab/sección MGA correspondiente), `IsResolved` (bool).
    - Actualizado `FormulationAuditResponse` para retornar `findings []AuditFinding` además de `blockers` y `warnings` para retrocompatibilidad.
  - `starter/backend/internal/infrastructure/persistence/postgres/mga_repository.go`:
    - Implementados métodos de conteo determinista: `CountTargetPopulations(ctx, projectID, tenantID)` y `CountAlternatives(ctx, projectID, tenantID)`.
  - `starter/backend/internal/application/project/formulation_audit_service.go`:
    - Implementada validación híbrida: controles deterministas de la "columna vertebral" MGA + análisis cualitativo y narrativo.
    - Regla 1 (Árbol de problemas): El problema central debe tener al menos 1 causa (directa o indirecta) y al menos 1 efecto (directo o indirecto) -> `CRITICAL`.
    - Regla 2 (Población y Localización): Al menos 1 población objetivo y localización geográfica definida (departamento, municipio o centro poblado) -> `CRITICAL`.
    - Regla 3 (Objetivos y Alternativas): Cada objetivo específico debe asociarse a al menos una alternativa de solución formulada -> `CRITICAL`.
    - Regla 4 (Cadena de Valor EDT y Costos): La EDT debe contener actividades y ninguna actividad puede tener cantidad <= 0 o costo unitario <= 0 -> `CRITICAL`.
    - Regla 5 (Calidad narrativa): Diagnóstico de situación existente (min. 20 caracteres) y magnitud del problema (min. 10 caracteres) -> `WARNING`.
    - Regla 6 (Verificados): Controles superados generan hallazgos tipo `SUCCESS`.
  - `starter/backend/internal/interfaces/http/handlers/formulation_audit_handler.go`:
    - Inyectado `postgres.NewProjectEdtRepository(db)` en `FormulationAuditService` para verificación presupuestal de actividades EDT.
  - `starter/backend/internal/application/project/formulation_audit_service_test.go`:
    - Cobertura completa de casos bloqueantes deterministas (árbol de problemas, población, localización, objetivos sin alternativas, EDT sin actividades o con costos en cero), proyecto inexistente y proyecto aprobado.
- **Frontend (React / TypeScript / Zustand):**
  - `starter/frontend/src/lib/formulationAuditApi.ts`:
    - Actualizados tipos: `AuditSeverity` ('CRITICAL' | 'WARNING' | 'SUCCESS'), `AuditFinding` (`id`, `message`, `severity`, `sectionKey`, `isResolved`) y mapeo normalizado bidireccional (`snake_case` / `camelCase`).
  - `starter/frontend/src/store/formulationAuditStore.ts`:
    - Añadida acción `toggleFindingResolved(findingId: string)` para permitir el seguimiento interactivo del usuario sobre los hallazgos resueltos.
  - `starter/frontend/src/components/Tenant/MGA/FormulationAuditPanel.tsx`:
    - Agrupación visual en 3 paneles diferenciados:
      1. **Hallazgos Críticos Bloqueantes (`CRITICAL`)**: Contenedor rojo de alta visibilidad, badge "BLOQUEANTE", contador de pendientes, descripción destacada.
      2. **Advertencias Cualitativas (`WARNING`)**: Contenedor ámbar, badge "ADVERTENCIA MGA".
      3. **Requisitos Estructurales Verificados (`SUCCESS`)**: Contenedor esmeralda, badge "VERIFICADO".
    - Botón "Ir a gestionar" / "Corregir ↗" en cada hallazgo que enruta dinámicamente al Tab o Sub-tab MGA exacto indicado por el `SectionKey` o texto del hallazgo.
    - Checkbox para marcar hallazgos como resueltos (`isResolved`).
    - **Bloqueo de Viabilidad (Requisito 4)**: Implementado botón "Enviar a Viabilidad" que permanece `disabled` mientras existan hallazgos `CRITICAL`, desplegando tooltip restrictivo y alerta explicativa; cuando todos los hallazgos críticos están subsanados, se habilita y permite enviar el proyecto actualizando su estado a `EN_VIABILIDAD`.
  - `starter/frontend/src/components/Tenant/MGA/MGALayout.tsx`:
    - Integrado `CadenaValorTab` en `SUB_SECTIONS_PREPARACION` y en `renderWorkArea`.
    - Sincronización automática de etapa principal (`activeMainStage`) según el sub-tab destino y navegación manual entre etapas.
  - `starter/frontend/src/pages/tenant/ProjectDetailPage.tsx`:
    - Estado reactivo en el botón "Validar y Enviar", señalando estado bloqueado si existen hallazgos críticos pendientes y conectando `onSentToViability` para refrescar el proyecto.
  - `starter/frontend/src/components/Tenant/MGA/FormulationAuditPanel.test.tsx` [NUEVO]:
    - Suite de 7 pruebas unitarias con Vitest y `@testing-library/react` verificando mapeo de tabs, agrupación por severidad, bloqueo estricto de viabilidad y toggle de resolución.
- **Validación:**
  - `cd starter/backend && go test -v ./internal/application/project/...` -> 100% PASS (Exit Code 0).
  - `cd starter/backend && go build ./...` -> Exit Code 0.
  - `cd starter/frontend && npx vitest run src/components/Tenant/MGA/FormulationAuditPanel.test.tsx` -> 7/7 PASS (Exit Code 0).
  - `cd starter/frontend && npm run build` (`tsc -b && vite build`) -> Exit Code 0.

### 2026-09-25 - Antigravity - Corrección Overflow en Tabla de Información Básica (PDF Dec. 1278)

- **Objetivo:** Corregir el desbordamiento visual de texto en las celdas de la tabla de metadatos básicos (Sección 1: "Nombre del proyecto") y demás tablas del PDF del Documento Técnico del Valle del Cauca (`technical_document_valle_service.go`).
- **Archivos modificados:**
  - `starter/backend/internal/application/project/technical_document_valle_service.go`:
    - Implementada función auxiliar `TruncateTextToFit(pdf *gofpdf.Fpdf, text string, maxWidth float64, txt func(string) string) string` que mide el ancho en milímetros del texto traducido con la fuente activa (`pdf.GetStringWidth`), recortando carácter a carácter (por runas seguras) y añadiendo `"..."` si supera `maxWidth - padding`.
    - Redistribuidos los anchos de columna de la tabla de metadatos de 45/45/45/45 a:
      - Columna 1 (Etiqueta BPIN / Prog): `40mm`
      - Columna 2 (Valor BPIN / Prog): `35mm`
      - Columna 3 (Etiqueta Sector / Prod): `38mm`
      - Columna 4 (Valor Sector / Prod): `67mm` (ampliando el espacio para sectores largos)
      - Fila "Objeto a entregar": `40mm` / `140mm`
    - Aplicado `TruncateTextToFit` en los valores de la tabla de información básica, así como en las tablas de población, nodos EDT y actividades presupuestales.
  - `starter/backend/internal/application/project/technical_document_valle_service_test.go`:
    - Añadida prueba `TestTruncateTextToFit` para validar que textos cortos se mantengan intactos, textos largos se trunquen con `"..."` respetando el ancho máximo, y la manipulación de runas sea segura con caracteres y tildes en español.
- **Validación ejecutada:**
  - `cd starter/backend && go test -v ./internal/application/project/...` -> PASS (Exit Code 0).
  - `cd starter/backend && go build ./...` -> Exit Code 0.
  - `cd starter/frontend && npx tsc --noEmit` -> Exit Code 0.

### 2026-09-25 - Antigravity - Exportación de Documento Técnico (Decreto 1278 de 2023 Valle del Cauca)

- **Objetivo:** Implementar en el backend (Go) el servicio y endpoint de generación del "Documento Técnico del Proyecto de Inversión" exigido por el Artículo 13, literal e) del Decreto 1278 de 2023 del Valle del Cauca con los 12 títulos exactos requeridos, y habilitar su descarga en el frontend (React).
- **Archivos creados / modificados:**
  - `starter/backend/go.mod` y `go.sum`: Añadida dependencia `github.com/jung-kurt/gofpdf v1.16.2`.
  - `starter/backend/internal/application/project/technical_document_valle_service.go` [NUEVO]: Servicio de generación de PDF con maquetación institucional del Valle del Cauca, traducción de caracteres Unicode/ISO-8859-1 y los 12 títulos exactos:
    1. Nombre del proyecto
    2. Contribución al plan nacional y plan departamental de desarrollo
    3. Problema, oportunidad o necesidad
    4. Descripción de la situación existente y antecedentes
    5. Justificación
    6. Objetivos (general y específicos)
    7. Árbol de problemas y árbol de soluciones
    8. Población afectada y objetivo
    9. Descripción de la alternativa seleccionada
    10. Productos y componentes de la inversión
    11. Cronograma de actividades
    12. Localización del proyecto
  - `starter/backend/internal/application/project/technical_document_valle_service_test.go` [NUEVO]: Pruebas unitarias para validar la correcta generación del buffer PDF con las 12 secciones.
  - `starter/backend/internal/interfaces/http/handlers/project_export_handler.go` [NUEVO]: Handler HTTP que verifica pertenencia al tenant, recupera proyecto (con Preload de Tenant), bundle MGA completo y cadena EDT completa, retornando el PDF binario con headers de descarga.
  - `starter/backend/internal/interfaces/http/router/projects.go`: Registro de rutas `GET /:id/export/technical-document-valle` tanto en `/api/v1/projects` como en `/api/v1/tenant/projects`.
  - `starter/frontend/src/lib/mgaApi.ts`: Exportación de la función `downloadTechnicalDocumentValle(projectId, projectName)` que consume el endpoint y dispara la descarga en el navegador como Blob.
  - `starter/frontend/src/components/Tenant/MGA/TechnicalDocumentValleExportButton.tsx` [NUEVO]: Botón diferenciado con contorno y acento verde esmeralda e ícono de documento legal (`FileText`) con texto `"Descargar Documento Técnico (Dec. 1278)"`.
  - `starter/frontend/src/components/Tenant/MGA/TechnicalDocumentValleExportButton.test.tsx` [NUEVO]: Pruebas de render y llamada al API para el botón.
  - `starter/frontend/src/pages/tenant/ProjectDetailPage.tsx`: Integración del botón en la barra superior de acciones del proyecto.
  - `starter/frontend/src/components/Tenant/ProjectSummary.tsx`: Integración del botón en la barra de exportación del resumen.
  - `starter/frontend/src/components/Tenant/MGA/MgaFormulationShell.tsx`: Integración del botón en las acciones del banner de la shell de formulación MGA.
- **Validación ejecutada:**
  - `go test -v ./internal/application/project/...` -> PASS (Exit Code 0).
  - `cd starter/backend && go build ./...` -> Compilación limpia (Exit Code 0).
  - `npx vitest run src/components/Tenant/MGA/TechnicalDocumentValleExportButton.test.tsx` -> 2 passed (Exit Code 0).
  - `cd starter/frontend && npx tsc --noEmit` -> Verificación de tipos limpia (Exit Code 0).

### 2026-09-25 - Antigravity - Unidad de Medida en Resumen de Producto del Catálogo DNP

- **Objetivo:** Mostrar la columna/campo `unidad_de_medida` en la tarjeta de resumen ("Producto seleccionado") cuando un usuario selecciona un Producto en la vista del Catálogo DNP (`/tenant/catalog`).
- **Archivos modificados:**
  - `starter/frontend/src/pages/tenant/CatalogPage.tsx`:
    - Se ajustó la cuadrícula de detalles de `<dl>` a `grid-cols-1 sm:grid-cols-2 md:grid-cols-4`.
    - Se añadió el bloque para "Unidad de medida" mostrando `selectedProduct.unidad_de_medida` con fallback `"No especificada"`.
- **Validación ejecutada:**
  - `npx tsc --noEmit` -> Exit Code 0 (limpio).
  - `npx tsc -b` -> Exit Code 0 (limpio).


### 2026-09-25 - Antigravity - Conexión de Catálogo DNP con Creación Asistida de Proyectos

- **Objetivo:** Conectar la vista del Catálogo DNP (`/tenant/catalog`) con el flujo de Creación Asistida de Proyectos en `/tenant/projects`, preseleccionando el Sector y Producto y abriendo automáticamente el asistente de ideación con Aurora y el formulario final estructurado.
- **Archivos modificados:**
  - `starter/frontend/src/pages/tenant/CatalogPage.tsx`:
    - El botón "Formular Proyecto con este Producto" ahora redirige a `/tenant/projects` con `state: { openIdeation: true, preselectedSectorCode, preselectedProductCode }`.
    - Se limpiaron estados, funciones y modales locales redundantes para unificar la creación de proyectos en el flujo guiado estándar.
  - `starter/frontend/src/pages/tenant/ProjectsDashboard.tsx`:
    - Detecta `state.openIdeation` mediante `useLocation`, extrae los códigos preseleccionados y abre automáticamente `CreateProjectModal`.
    - Limpia el historial con `window.history.replaceState` para evitar reaperturas accidentales al refrescar la página.
  - `starter/frontend/src/pages/tenant/ProjectCreationAssistant.tsx`:
    - Acepta props y estado de router para `preselectedSectorCode` y `preselectedProductCode`.
    - Preselecciona el sector y producto cuando están disponibles en el catálogo.
  - `starter/frontend/src/components/Tenant/CreateProjectModal.tsx`:
    - Acepta `preselectedSectorCode` y `preselectedProductCode` como props opcionales.
    - Autocompleta `sectorId` (mapeando código de sector a su UUID en el catálogo) y `productoPrincipal`.
    - Inyecta el contexto del sector y producto en el mensaje inicial del asistente de ideación de Aurora.
    - Protege la selección de producto contra borrado accidental durante la carga reactiva de productos por sector.
- **Validación ejecutada:**
  - `npx tsc --noEmit` -> Exit Code 0 (limpio).
  - `npx tsc -b` -> Exit Code 0 (limpio).
  - Backend `go build ./...` -> Exit Code 0 (limpio).


### 2026-09-25 - Antigravity - Eliminación de Textos por Defecto en Árbol de Problemas (UX)

- **Objetivo:** Eliminar los textos por defecto ("Nueva causa directa...", "Nuevo efecto directo...", etc.) al crear nodos en el Árbol de Problemas, permitiendo que las tarjetas se abran con el `<textarea>` y `<AIAssistedField>` vacíos y listos para recibir input o asistencia de IA.
- **Archivos modificados:**
  - `starter/backend/internal/interfaces/http/dto/mga_dto.go`: Modificada la validación de `Description` en `CreateMgaCauseRequest` y `UpdateMgaCauseRequest` a `max=5000` (eliminando `required,min=2`) para permitir la creación de nodos con descripción vacía desde la UI.
  - `starter/backend/internal/interfaces/http/dto/mga_extended_dto.go`: Modificada la validación de `Description` en `CreateMgaEffectRequest` y `UpdateMgaEffectRequest` a `max=5000` para soportar creación con descripción vacía.
  - `starter/frontend/src/store/projectMgaStore.ts`: Actualizados los métodos `addCause` y `addEffect` para retornar el nodo recién creado (`Promise<CauseObjectiveRelation>` y `Promise<MgaEffect>`).
  - `starter/frontend/src/components/Tenant/MGA/IdentificacionTab.tsx`:
    - En `handleAddDirectEffect`, `handleAddIndirectEffect`, `handleAddDirectCause` y `handleAddIndirectCause`, los payloads envían `description: ""` (y `specific_objective: ""`).
    - Al crearse el nodo, se invoca automáticamente `setEditTarget` con el ID del nuevo nodo y `draft: ""`.
    - En `renderEffectCard` y `renderCauseCard`, se muestra automáticamente el modo edición/textarea vacío (`placeholder` contextual y `autoFocus`) cuando la descripción está vacía o el nodo está siendo editado.
- **Validación:**
  - `npx tsc --noEmit` -> Exit Code 0 (limpio).
  - `npx tsc -b` -> Exit Code 0 (limpio).
  - Backend `go build ./...` -> Exit Code 0 (limpio).


### 2026-09-25 - Antigravity - Corrección TS6133 en IdentificacionTab

- **Objetivo:** Eliminar variable declarada y no leída `isProblemTreeComplete` en `IdentificacionTab.tsx` que provocaba fallo de compilación TypeScript (`TS6133`) en el pipeline de build.
- **Archivos modificados:**
  - `starter/frontend/src/components/Tenant/MGA/IdentificacionTab.tsx`: Se removió la declaración redundante de `isProblemTreeComplete`, manteniendo la validación detallada en `handleSaveSection` con `missingParts`.
- **Validación ejecutada:**
  - `npx tsc -b` -> Exit Code 0 (limpio).
  - `npx tsc --noEmit` -> Exit Code 0 (limpio).


### 2026-09-25 - Antigravity - Reglas de Negocio Estrictas MGA (Marco Lógico) en Frontend y Prompts Backend

- **Objetivo:** Implementar reglas metodológicas estrictas de la Metodología de Marco Lógico (MGA) en el frontend y en la construcción de los System Prompts de IA en el backend:
  1. Las causas directas son directamente proporcionales a los objetivos específicos.
  2. Las causas indirectas deben estar relacionadas con las actividades del proyecto.
  3. El problema central va directamente relacionado con el objetivo general del proyecto.
  4. Las causas deben ser ingresadas ANTES que los efectos (bloqueo condicional y advertencias).
  5. Las causas deben estar relacionadas al producto.
  6. Las causas y efectos (directos e indirectos) deben estar registrados obligatoriamente para poder avanzar/guardar la problemática y acceder a Objetivos.
- **Archivos modificados:**
  - `starter/backend/internal/interfaces/http/dto/ai_dto.go`: Soportado campo `Field` adicional en `SuggestFieldRequest`.
  - `starter/backend/internal/interfaces/http/handlers/ai_handler.go`: Inyectadas las reglas metodológicas exactas según el campo solicitado (`objetivo_general`, `objetivos_especificos`, `actividades`/`cadena_valor`, `productos`/`alternativa`).
  - `starter/frontend/src/components/Tenant/MGA/IdentificacionTab.tsx`:
    - Regla 4: Bloqueo de adición/asistencia de efectos directos e indirectos si faltan causas directas o indirectas, con mensaje explícito: *"Debe registrar primero las causas antes de identificar los efectos"*.
    - Regla 6: Validación en `handleSaveSection` exigiendo Problema Central, Causas (Dir/Ind) y Efectos (Dir/Ind) completos antes de marcar la sección como finalizada.
  - `starter/frontend/src/components/Tenant/MGA/MGALayout.tsx`: Bloqueo condicional de navegación hacia la pestaña `objetivos` y etapas posteriores si el Árbol de Problemas está incompleto, con tooltips y banner de aviso de sección bloqueada.
  - `starter/frontend/src/components/Tenant/MGA/ObjetivosTab.tsx`: Detección de completitud del árbol de problemas, banner informativo de advertencia metodológica y validación en guardado. Recordatorio de relación problema central - objetivo general y causas directas - objetivos específicos.
  - `starter/frontend/src/components/Tenant/MGA/CadenaValorTab.tsx`: Añadidas notas metodológicas para la relación de causas indirectas con actividades y de causas con productos.
- **Validaciones ejecutadas:**
  - `cd starter/frontend && npx tsc --noEmit` (Exit Code 0).
  - `cd starter/backend && go build ./...` (Exit Code 0).

### 2026-09-25 - Antigravity - Validación Estricta de Longitud de Caracteres (`maxLength`) End-to-End

- **Objetivo:** Implementar validación estricta de longitud de caracteres de extremo a extremo: en elementos HTML del frontend, payload de la API y prompt del modelo en el backend.
- **Archivos modificados:**
  - `starter/backend/internal/interfaces/http/dto/ai_dto.go`: Verificado campo `MaxLength int json:"max_length,omitempty"`.
  - `starter/backend/internal/interfaces/http/handlers/ai_handler.go`: Inyectada la regla exacta y estricta en el System Prompt cuando `req.MaxLength > 0`: `"REGLA CRÍTICA Y ESTRICTA: El texto que generes debe tener una longitud estrictamente MENOR a %d caracteres en total (incluyendo espacios). Si te excedes, el sistema de base de datos fallará. Sé conciso."`.
  - `starter/frontend/src/components/AuroraAsistente/AIAssistedField.tsx`: Asegurado el paso explícito de `maxLength` al elemento hijo (`textarea`/`input`) mediante clonado con preservación de propiedades y reenvío de `maxLength` al store de IA.
  - `starter/frontend/src/components/Tenant/MGA/ParticipantesTab.tsx`: Ajustado `maxLength={200}` para intereses y `maxLength={2000}` para contribuciones.
  - `starter/frontend/src/components/Tenant/MGA/NecesidadesTab.tsx`: Actualizado `maxLength={500}` para bien/servicio.
  - `starter/frontend/src/components/Tenant/MGA/AnalisisTecnicoTab.tsx`: Actualizado `maxLength={2000}` para resumen de la alternativa.
  - `starter/frontend/src/components/Tenant/MGA/CadenaValorTab.tsx`: Actualizado `maxLength={400}` para nombre del nodo/producto.
  - `starter/frontend/src/components/Tenant/MGA/RiesgosTab.tsx`: Actualizado `maxLength={500}` en descripción, efectos y medidas de mitigación.
  - `starter/frontend/src/components/Tenant/MGA/IngresosBeneficiosTab.tsx`: Actualizado `maxLength={400}` en descripción del beneficio.
  - `starter/frontend/src/components/Tenant/MGA/PrestamosTab.tsx`: Actualizado `maxLength={500}` en entidad/concepto, `maxLength={5}` en tasa y `maxLength={2}` en plazo en años.
  - `starter/frontend/src/components/Tenant/MGA/DepreciacionTab.tsx`: Actualizado `maxLength={2}` en vida útil (años).
- **Validaciones ejecutadas:**
  - `cd starter/backend && go build ./...` (Exit Code 0).
  - `cd starter/frontend && npx tsc --noEmit` (Exit Code 0).

### 2026-09-25 - Antigravity - Corrección Tipado TS2322 en Mocks de Test y Soporte Resiliente de Progress

- **Objetivo:** Resolver el error de compilación `TS2322` en `src/store/projectStore.test.ts` que bloqueaba el pipeline de build de producción (`tsc -b && vite build`) tras la introducción del campo `progress` en el modelo `Project`.
- **Archivos modificados:**
  - `starter/frontend/src/store/projectStore.test.ts`: Se actualizó la función fábrica `project` para inicializar por defecto `progress: overrides.progress ?? 0`, asegurando total compatibilidad con la interfaz.
  - `starter/frontend/src/store/projectStore.ts`: Se definió `progress?: number` en el tipo `Project` para mayor resiliencia en casos donde el progreso aún no haya sido provisto o instanciado.
- **Validaciones ejecutadas:**
  - `cd starter/frontend && npx tsc -b` completado con Exit Code 0.
  - `cd starter/frontend && npx tsc --noEmit` completado con Exit Code 0.
  - `cd starter/frontend && npm run build` (`tsc -b && vite build`) completado con Exit Code 0.
  - `npx vitest run src/store/projectStore.test.ts` (30/30 pruebas superadas).
  - `npx vitest run src/pages/tenant/ProjectsDashboard.test.tsx` (26/26 pruebas superadas).

### 2026-09-16 - Antigravity - Integración de Autollenado AI en Campos MGA

- **Objetivo:** Finalizar la integración del componente `AIAssistedField` en los formularios MGA restantes para sugerencias de autollenado contextual guiadas por Aurora Copilot.
- **Archivos modificados:**
  - `mgaFieldsKnowledge.ts`: Se ampliaron las reglas y templates para incluir `plan_desarrollo`, `estrategia_desarrollo`, `programa_desarrollo`, `instrumentos_etnicos`, `intereses_participante`, y `contribucion_participante`. Se mejoró la estructura de `ProjectContext`.
  - `PlanDesarrolloTab.tsx`: Se reemplazaron 10 `textarea` por `AIAssistedField` conectándolos con las respectivas llaves de conocimiento y `onAutoFill`.
  - `PoblacionTab.tsx`: Se integró el autollenado en la sección de características demográficas, diferenciando entre población objetivo y afectada.
  - `ParticipantesTab.tsx`: Se conectó el autollenado para el análisis de intereses y contribuciones de los actores, usando el contexto del proyecto y el actor/entidad actual.
- **Validación ejecutada:** `npx tsc --noEmit` exitoso en el frontend.

### 2026-09-16 - Antigravity - Estandarización de Stepper y Botones de Guardado (MGA)

- **Objetivo:** Refactorizar la navegación por etapas (Stepper) para que dependa de un guardado explícito ("Guardar Módulo") en lugar de activarse automáticamente al agregar datos.
- **Archivos modificados:**
  - `projectMgaStore.ts`: Se añadió el diccionario `completedSections` y múltiples funciones `saveX` (mockeadas).
  - `MGALayout.tsx`: Se conectaron las etapas a `formulation.completedSections`.
  - `IdentificacionTab.tsx`, `ParticipantesTab.tsx`, `PoblacionTab.tsx`, `ObjetivosTab.tsx`, `CadenaValorTab.tsx`, `AlternativasTab.tsx`, `PlanDesarrolloTab.tsx`: Se les agregó el botón estándar de color `bg-blue-600` en la parte inferior junto con lógica y alertas (`MgaAlert`) para validar su guardado y transición.
- **Validación ejecutada:** `npx tsc --noEmit` completado exitosamente sin errores (Exit Code 0).

### 2026-09-16 - Antigravity - Módulo Plan de Desarrollo (MGA)

- **Objetivo:** Construir la interfaz de Plan de Desarrollo con sus 5 secciones según especificaciones DNP y conectar la lógica de autoguardado para desbloquear etapas siguientes.
- **Archivos modificados/creados:**
  - `starter/frontend/src/store/projectMgaStore.ts`: Se definieron los tipos de `PlanDesarrolloData` y se implementó `savePlanDesarrollo` con soporte mock.
  - `starter/frontend/src/components/Tenant/MGA/MGALayout.tsx`: Se conectó el estado para requerir la completitud de Plan de Desarrollo y habilitar la sección Problemática.
  - `starter/frontend/src/components/Tenant/MGA/PlanDesarrolloTab.tsx`: [NUEVO] Componente principal estructurado con acordeones para PND, Planes Departamentales, Municipales, Instrumentos Étnicos y Otros, cumpliendo criterios de accesibilidad (contadores, text-base, etc).
- **Validación ejecutada:** `npx tsc --noEmit` completado exitosamente sin errores de tipado.

### 2026-09-16 - Antigravity - Corrección Build Docker TS2551

- **Objetivo:** Resolver el error de tipos en `MGALayout.tsx` que impedía el build del frontend en producción.
- **Archivos modificados:**
  - `starter/frontend/src/components/Tenant/MGA/MGALayout.tsx`: Se actualizó el selector del store de Cadena de Valor (EDT) de `getEdtChain` a `getChain` coincidiendo con la firma de `projectEdtStore.ts`. Además, se corrigió el acceso de longitud validando sobre `.edtNodes.length`.
- **Validación ejecutada:** `npx tsc --noEmit` completado exitosamente sin errores de tipado.

### 2026-09-16 - Antigravity - Flujo Secuencial (Stepper) en Formulación MGA

- **Objetivo:** Transformar la navegación del proyecto en un asistente secuencial estricto donde las secciones deben completarse en orden (Plan de desarrollo ➔ Problemática ➔ Participantes, etc.) y bloquear accesos prematuros para guiar correctamente la formulación.
- **Archivos modificados:**
  - `starter/frontend/src/components/Tenant/MGA/MGALayout.tsx`: Se implementaron los hooks locales `useMgaSectionStatuses` y `useMgaMainStageStatuses` que evalúan dinámicamente el progreso analizando los arreglos y propiedades del proyecto en el store de Zustand (ej: si hay participantes guardados, desbloquea Población). Se rediseñó el renderizado del sidebar y la barra superior para reflejar visualmente los estados `COMPLETED` (check verde), `ACTIVE` (seleccionable) y `LOCKED` (candado, gris, deshabilitado).
- **Validación ejecutada:** `npx tsc --noEmit` completado exitosamente sin errores de tipado.

### 2026-09-16 - Antigravity - Sanitización de Errores de Validación y UI

- **Objetivo:** Mejorar la experiencia del usuario final evitando que vea nombres técnicos o errores crudos (ej: "CreateProjectRequest.Objeto") provenientes de las reglas de validación en Go. Además, se agregaron validaciones visuales preventivas en el frontend y textos de ayuda para cumplir con las reglas de longitud.
- **Archivos modificados:**
  - `starter/backend/internal/interfaces/http/handlers/project_handler.go`: Se interceptó el error de tipo `validator.ValidationErrors` arrojado por `dto.Validate`. Se iteran los errores de campo y se traducen a mensajes explícitos en español (ej: para `Objeto`, `ProcesoID` y `Localizaciones`) antes de devolver el HTTP 400.
  - `starter/frontend/src/store/projectStore.ts`: Se reforzó el traductor de errores en `extractError` para atrapar las combinaciones de strings técnicos residuales en caso de que un validador no sea atrapado por el backend, mapeándolos a textos de UI amigables.
  - `starter/frontend/src/components/Tenant/CreateProjectModal.tsx` y `starter/frontend/src/pages/tenant/ProjectCreationAssistant.tsx`: Se agregaron textos de ayuda permanentes indicando "Mínimo 10 caracteres" para el campo Objeto. Se configuró una pre-validación bloqueante al pulsar crear (`objeto.trim().length < 10`) para frenar la solicitud antes de siquiera tocar la red y mostrar un error inmediato amigable.
- **Validación ejecutada:** `go build ./...` y `npx tsc --noEmit` completadas exitosamente sin errores.

### 2026-09-16 - Antigravity - Corrección de Payload en Creación de Proyectos MGA

- **Objetivo:** Resolver el error HTTP 400 (Bad Request) proveniente de Go al crear un proyecto garantizando el envío íntegro de todos los campos MGA obligatorios requeridos por la base de datos y la API.
- **Archivos modificados:**
  - `starter/frontend/src/store/projectStore.ts`: Se refactorizó la asignación del objeto JSON `body` en la función `createProject`. Anteriormente filtraba los nuevos campos MGA (`proceso_id`, `objeto`, `localizaciones`, `tipo_inversion`, `tipologia`); ahora los inyecta en el objeto que se envía a la API de Go.
  - `starter/frontend/src/lib/auroraActionDispatcher.ts`: Se corrigió el despacho asíncrono para proyectos iniciados vía IA, reemplazando los parámetros duros (ej. `proceso_id: 1`) por la información extraída dinámicamente desde el `CreationContext` del componente principal.
- **Validación ejecutada:** Comprobación estricta de TypeScript mediante `npx tsc --noEmit` completada sin advertencias.

### 2026-09-16 - Antigravity - Rediseño UX/UI Accesible para Localizaciones

- **Objetivo:** Mejorar drásticamente la accesibilidad (enfocada en adultos mayores) del bloque de selección de localizaciones (Región, Departamento, Municipio) en los modales de creación de proyecto, migrando de un layout horizontal estrecho a tarjetas (Cards) verticales amplias, y aumentando los tamaños de fuente.
- **Archivos modificados:**
  - `starter/frontend/src/components/Catalog/SearchableCombobox.tsx`: Se elevó el tamaño de la tipografía base a `text-base` (16px mínimo) en la etiqueta (`label`) y en las opciones de lista para mayor legibilidad.
  - `starter/frontend/src/components/Tenant/CreateProjectModal.tsx`: Se reestructuró la cuadrícula de localizaciones usando un diseño de Tarjetas (`Card layout`). Se cambió la orientación horizontal por una vertical, integrando un resumen inferior (Badge de confirmación) una vez seleccionada una ubicación completa. Se rediseñó el botón "Agregar localización" para hacerlo más evidente y fácil de hacer clic.
  - `starter/frontend/src/pages/tenant/ProjectCreationAssistant.tsx`: Se aplicó exactamente el mismo rediseño estructural de Tarjetas y botón de agregar, manteniendo la sincronización entre ambos flujos.
- **Validación ejecutada:** Ejecución de `npx tsc --noEmit` completada sin errores (exit code 0).

### 2026-09-16 - Antigravity - Corrección Estricta de TypeScript (TS6133)

- **Objetivo:** Eliminar variables declaradas pero no utilizadas tras las recientes refactorizaciones en los catálogos para evitar el quiebre del build de Docker en el pipeline.
- **Archivos modificados:**
  - `starter/frontend/src/components/Tenant/CreateProjectModal.tsx`: Se eliminó la importación `formatCatalogProductOptionTitle` sin uso de `catalogStore`.
  - `starter/frontend/src/pages/tenant/ProjectCreationAssistant.tsx`: Se eliminó la misma importación `formatCatalogProductOptionTitle`.
- **Validación ejecutada:** `npx tsc --noEmit` completó exitosamente (exit code 0).

### 2026-09-16 - Antigravity - Estandarización de SearchableCombobox y UI Cleanliness

- **Objetivo:** Asegurar que los selectores de búsqueda (Proceso, Sector, Producto, Localizaciones) en los formularios de creación de proyectos solo muestren nombres (sin códigos/IDs) en la UI y mejoren la calidad de búsqueda ignorando acentos y mayúsculas.
- **Archivos modificados:**
  - `starter/frontend/src/components/Catalog/SearchableCombobox.tsx`: Se mejoró la función `normalizeText` utilizando `.normalize('NFD')` para omitir acentos en el filtro interno. Se ajustó `formatOptionLabel` para que solo renderice el `label` (sin concatenar el código base).
  - `starter/frontend/src/components/Tenant/CreateProjectModal.tsx`: Se limpiaron las opciones de catálogos eliminando el ID del string de la propiedad `label`. Se refactorizaron los 3 `<select>` de Localizaciones a componentes `<SearchableCombobox>`.
  - `starter/frontend/src/pages/tenant/ProjectCreationAssistant.tsx`: Similar al modal, se depuró el `label` de las opciones para procesos, sectores, programas y productos. También se migraron los selectores de localizaciones (Región, Departamento, Municipio) al estándar `SearchableCombobox`.
- **Validación ejecutada:** `npx tsc --noEmit` en frontend exitoso (exit code 0).

### 2026-09-16 - Antigravity - Corrección del límite en la obtención de procesos MGA

- **Objetivo:** Asegurar que el selector de "Proceso" en el formulario de creación de proyectos cargue la lista completa (102 procesos) en lugar de truncarse a los 10 primeros registros.
- **Archivos modificados:**
  - `starter/backend/internal/interfaces/http/handlers/admin_proceso_handler.go`: Se incrementó el límite máximo de 100 a 1000 en el parseo de paginación para `ListProcesos`.
  - `starter/frontend/src/store/locationStore.ts`: Se ajustó la petición `api.get` en `fetchProcesos` enviando los query params `limit=1000` y `page=1`.
- **Validación ejecutada:** `go build ./...` en backend exitoso y `npx tsc --noEmit` en frontend exitoso (exit code 0 en ambos).

### 2026-09-16 - Antigravity - Correcciones Estrictas de TypeScript en Formularios

- **Objetivo:** Solucionar errores de TypeScript estricto (`TS2448`, `TS2454`, `TS6133`) reportados en el proceso de build de Docker tras las últimas modificaciones en el formulario de creación de proyectos.
- **Archivos modificados:**
  - `starter/frontend/src/components/Tenant/CreateProjectModal.tsx`: Se reubicó la variable `filteredSectors` antes de su uso (TS2448).
  - `starter/frontend/src/components/Tenant/ProductDetailModal.tsx`: Se removió el import innecesario de `React` (TS6133).
  - `starter/frontend/src/pages/tenant/ProjectCreationAssistant.tsx`: Se renombró el parámetro no utilizado `code` a `_code` (TS6133).
- **Validación ejecutada:** `npx tsc --noEmit` en frontend completó sin errores (exit code 0).

### 2026-09-16 - Antigravity - Mejora del Formulario de Creación de Proyectos

- **Objetivo:** Simplificar y mejorar la usabilidad del formulario de creación de proyectos (`/tenant/projects`), eliminando campos y usando catálogos buscables.
- **Archivos modificados:**
  - `starter/frontend/src/store/locationStore.ts`: Se ajustó `fetchProcesos` con `limit=1000`.
  - `starter/frontend/src/components/Tenant/ProductDetailModal.tsx`: Se creó el componente `ProductDetailModal`.
  - `starter/frontend/src/components/Tenant/CreateProjectModal.tsx`: Se eliminaron campos "Código BPIN" y "Descripción", se cambió Proceso, Sector y Producto a `SearchableCombobox`. Se integró `ProductDetailModal`.
  - `starter/frontend/src/pages/tenant/ProjectCreationAssistant.tsx`: Se cambió el selector de Proceso a `SearchableCombobox`. Se integró el botón "Ver detalle" junto con el `ProductDetailModal` para los productos.
- **Validación ejecutada:** `npx tsc --noEmit` en frontend exitoso (exit code 0).
- **Riesgos/Notas:** El payload de creación de proyectos (`CreateProjectPayload`) fue modificado ligeramente (se eliminaron `code_bpin` y `description`), lo cual era válido dado que eran opcionales, pero si el backend exige enviarlos aunque estén vacíos podría generar un error. (El esquema los manejaba opcionales).

### 2026-09-16 - Antigravity - Corrección de Props y Tipos en Paginación

- **Objetivo:** Resolver el error de compilación de TypeScript en `LocationsCatalogPage.tsx` y `ProcesosCatalogPage.tsx` por divergencia de propiedades en el componente `CatalogPagination`.
- **Archivos modificados:**
  - `starter/frontend/src/pages/admin/LocationsCatalogPage.tsx`: Se agregaron tipos explícitos para el arreglo interno `parsedLocations` (`any[]`) y el iterador de búsqueda (`region: any`) solucionando el error TS7022 (`implicitly has type 'any'`). Se actualizaron las properties pasadas a `<CatalogPagination />` para coincidir con la declaración del componente (`meta` y `onPageChange`).
  - `starter/frontend/src/pages/admin/ProcesosCatalogPage.tsx`: Se actualizaron las properties pasadas a `<CatalogPagination />` a la nueva interfaz que exige enviar el objeto meta completo en lugar de valores discretos desestructurados.
- **Validacion ejecutada:**
  - `npx tsc --noEmit` completó exitosamente (código 0), dejando el frontend libre de errores de tipado estrictos.

### 2026-09-16 - Antigravity - Corrección de Tipado en Frontend (Zustand & Paginación)

- **Objetivo:** Resolver errores estrictos de TypeScript causados por sintaxis de importación inválida y desestructuración incompleta del store, los cuales impedían la compilación del build de producción.
- **Archivos modificados:**
  - `starter/frontend/src/store/locationStore.ts`: Se corrigió la importación de `PaginationMeta` utilizando `import type` para cumplir con las reglas de `verbatimModuleSyntax`.
  - `starter/frontend/src/pages/admin/ProcesosCatalogPage.tsx`: Se eliminó el import no utilizado `useMemo` de React y se corrigió la ruta de importación de `CatalogPagination`.
  - `starter/frontend/src/pages/admin/LocationsCatalogPage.tsx`: Se eliminó el import no utilizado `useMemo`. Se reincorporaron `regions` y `fetchLocations` del store, y se restauró el array derivado `departamentos` para poder poblar los dropdowns modales. Se agregaron los tipos explícitos `(r: Region)` y `(d: Departamento & { regionName: string })` en los ciclos `map` para evitar el error `implicit any`.
- **Validacion ejecutada:**
  - `npx tsc --noEmit` completó exitosamente (código 0).

### 2026-09-16 - Antigravity - Importador CSV y Paginación de Localizaciones/Procesos

- **Objetivo:** Habilitar la importación masiva por archivos CSV en los catálogos y estandarizar la paginación con el diseño de la interfaz EDT, reduciendo la carga en los listados del admin.
- **Archivos modificados:**
  - `starter/backend/internal/interfaces/http/handlers/admin_location_handler.go`: Se creó el endpoint `ListAdminLocations` (con filtros `type`, `search`, `page`, `limit`).
  - `starter/backend/internal/interfaces/http/router/admin_locations.go`: Se expuso la ruta `GET /api/v1/admin/locations`.
  - `starter/frontend/src/lib/adminApi.ts`: Se ajustaron las firmas de los endpoints para enviar parámetros y recibir el wrapper de `PaginationMeta`.
  - `starter/frontend/src/store/catalogStore.ts` y `locationStore.ts`: Se agregaron los estados `meta` para paginación y se actualizó la lógica de fetching.
  - `starter/frontend/src/components/admin/CatalogImporterModal.tsx`: Se habilitó la extensión `.csv`.
  - `starter/frontend/src/pages/admin/ProcesosCatalogPage.tsx` y `LocationsCatalogPage.tsx`: Se incluyó un parseo local manual de CSV para estandarizar las columnas y se agregaron los componentes de búsqueda (`Search`) y `CatalogPagination`.
- **Logica implementada:**
  - El frontend transforma archivos CSV planos en los JSON jerárquicos esperados por el backend (ej. anidando departamentos y municipios bajo regiones) antes de enviar la petición de importación.
- **Dependencias:**
  - Ninguna nueva, el parser CSV se hizo localmente.
- **Validacion ejecutada:**
  - `go build ./...` y `npx tsc --noEmit` completaron sin errores (código 0).
- **Decisiones ADR:**
  - Parser CSV manual en la capa de vista para evitar nuevas librerías.
- **Riesgos y pendientes:**
  - Se debe asegurar de que el CSV a importar esté separado estrictamente por comas estándar y no contenga comas dentro de los strings (por ejemplo `"Bogotá, D.C."`) debido a que el parser implementado usa un `.split(',')` simple.

### 2026-09-16 - Antigravity - Corrección de Tipos en Metadatos de Paginación

- **Objetivo:** Resolver el error de compilación del backend Go ocasionado por el uso de nombres de campos incorrectos al inicializar la estructura `PaginationMeta` del DTO.
- **Archivos modificados:**
  - `starter/backend/internal/interfaces/http/handlers/admin_proceso_handler.go` - Actualizada la inicialización de `dto.PaginationMeta` para usar las propiedades correctas (`Page`, `LastPage`, `Total`, `Limit`) en lugar de los nombres en formato camelCase inconsistente.
- **Logica implementada:**
  - Se mapearon exactamente las propiedades del struct declarado en `catalog_dto.go` a sus respectivos valores calculados en la rutina de paginación del handler de procesos.
- **Dependencias:**
  - Ninguna
- **Validacion ejecutada:**
  - `go build ./...` - Exitoso (código 0).
- **Decisiones ADR:**
  - No aplica
- **Riesgos y pendientes:**
  - Ninguno

### 2026-09-16 - Antigravity - Corrección de restricción de clave única al importar Procesos

- **Objetivo:** Evitar que el importador de procesos falle por duplicados en la base de datos (e.g. verbo "Reparación") a causa de la restricción `idx_procesos_name`.
- **Archivos modificados:**
  - `starter/backend/internal/interfaces/http/handlers/admin_proceso_handler.go` - Se modificó la cláusula `clause.OnConflict` en el endpoint de importación masiva para apuntar a la columna `name`, haciendo que en caso de colisión de nombre sólo se actualice la marca `updated_at`.
- **Logica implementada:**
  - Al recibir verbos con nombres duplicados desde el frontend, GORM intercepta la violación del constraint de nombre único en PostgreSQL y aplica un "DoNothing" efectivo actualizando sólo una columna irrelevante para evitar crashear la transacción en bloque.
- **Dependencias:**
  - Ninguna
- **Validacion ejecutada:**
  - `go build ./...` - Exitoso (código 0).
- **Decisiones ADR:**
  - No aplica
- **Riesgos y pendientes:**
  - Ninguno

### 2026-09-16 - Antigravity - Migraciones GORM y Esquemas SQL para Catálogos MGA

- **Objetivo:** Resolver el error `relation does not exist` al importar catálogos de Procesos y Localizaciones agregando los nuevos modelos al `AutoMigrate` y documentando el DDL.
- **Archivos modificados:**
  - `starter/backend/internal/infrastructure/persistence/postgres/db.go` - Agregados `models.Proceso{}`, `models.Region{}`, `models.Departamento{}`, `models.Municipio{}` a la lista de `AutoMigrate`.
  - `docs/schema.sql` - Añadidos los bloques `CREATE TABLE` correspondientes a Procesos, Regiones, Departamentos y Municipios.
  - `docs/schema-antigravity.sql` - Añadidos los mismos bloques `CREATE TABLE` para mantener la sincronización documental de la arquitectura.
- **Logica implementada:**
  - Las tablas del catálogo ahora se generarán e instanciarán correctamente en la base de datos de PostgreSQL al inicializar o reconectar GORM, asegurando que los Endpoints de importación masiva no fallen por tablas inexistentes.
- **Dependencias:**
  - Ninguna
- **Validacion ejecutada:**
  - `go build ./...` - Exitoso (código 0).
- **Decisiones ADR:**
  - No aplica
- **Riesgos y pendientes:**
  - Ninguno

### 2026-09-16 - Antigravity - Limpieza de importaciones no utilizadas en Vistas Administrativas (TS6133)

- **Objetivo:** Resolver errores estrictos de TypeScript causados por imports no utilizados en la página de catálogo de localizaciones.
- **Archivos modificados:**
  - `starter/frontend/src/pages/admin/LocationsCatalogPage.tsx` - Eliminadas las funciones de desactivación (`adminToggleRegion`, `adminToggleDepartamento`, `adminToggleMunicipio`) que ya no se usan en el componente.
- **Logica implementada:**
  - Limpieza de desestructuración y código muerto.
- **Dependencias:**
  - Ninguna
- **Validacion ejecutada:**
  - `npx tsc --noEmit` - Exitoso (código 0).
- **Decisiones ADR:**
  - No aplica
- **Riesgos y pendientes:**
  - Ninguno

### 2026-09-16 - Antigravity - Corrección de errores de compilación TypeScript en catálogos de administración

- **Objetivo:** Resolver errores estrictos de TypeScript (TS2305, TS6133, TS2739) causados por imports incorrectos, variables no usadas y estados incompletos.
- **Archivos modificados:**
  - `starter/frontend/src/lib/adminApi.ts` - Corregida la importación de `Region`, `Departamento` y `Municipio` desde `locationStore`.
  - `starter/frontend/src/pages/admin/LocationsCatalogPage.tsx` - Eliminadas importaciones sin uso y función `handleToggle` muerta.
  - `starter/frontend/src/store/catalogStore.ts` - Agregados `procesos: []` e `isLoadingProcesos: false` a la inicialización de estado y renombrado de parámetro `get` a `_get`.
- **Logica implementada:**
  - Limpieza de código estricto y ajuste de variables del store de Zustand para cumplir la interfaz TS.
- **Dependencias:**
  - Ninguna
- **Validacion ejecutada:**
  - `npx tsc --noEmit` - Exitoso (código 0).
- **Decisiones ADR:**
  - No aplica
- **Riesgos y pendientes:**
  - Ninguno

### 2026-09-16 - Antigravity - Vistas de Administración para Catálogos MGA (Frontend)

- **Objetivo:** Implementar las vistas frontend de administración para gestionar Procesos y Localizaciones MGA por parte del Super Admin, incluyendo modales de importación masiva.
- **Archivos modificados:**
  - `starter/frontend/src/lib/adminApi.ts` - [NUEVO] Agregados métodos CRUD para Procesos y Localizaciones MGA.
  - `starter/frontend/src/store/catalogStore.ts` - Estado extendido para alojar y manejar CRUD de `Procesos`.
  - `starter/frontend/src/store/locationStore.ts` - Firmas actualizadas en estado para recarga de localizaciones saltando caché (`force`).
  - `starter/frontend/src/layouts/SuperAdminLayout.tsx` - Añadidas opciones de navegación a 'Procesos MGA' y 'Localizaciones MGA' en el menú lateral.
  - `starter/frontend/src/components/admin/CatalogImporterModal.tsx` - [NUEVO] Componente genérico reutilizable para importaciones drag-and-drop masivas vía JSON.
  - `starter/frontend/src/pages/admin/ProcesosCatalogPage.tsx` - [NUEVO] Paginación, lógica de importación y modal CRUD para Procesos.
  - `starter/frontend/src/pages/admin/LocationsCatalogPage.tsx` - [NUEVO] Estructura de tabs (Regiones/Departamentos/Municipios), lógica de importación masiva JSON y modales de actualización/creación manual.
  - `starter/frontend/src/App.tsx` - Importación y mapeo de rutas para las páginas de Procesos y Localizaciones MGA.
- **Logica implementada:**
  - Consumo directo de los handlers creados en el Backend (`admin_proceso_handler` y `admin_location_handler`).
  - Se habilitó UI interactiva de tabs para manejar Regiones, Departamentos y Municipios.
  - Modales de edición permiten desactivación lógica de registros para respetar las reglas de negocio (Soft delete con is_active).
- **Dependencias:**
  - Ninguna
- **Validacion ejecutada:**
  - `npx tsc --noEmit` - exitoso (código 0).
  - Componentes compilados y estáticamente validados en TS.
- **Decisiones ADR:**
  - Se separó la importación en un componente independiente `CatalogImporterModal.tsx` para evitar acoplar lógica genérica a los modales CSV de catálogos DNP que existían previamente (`CatalogImporter.tsx`).
- **Riesgos y pendientes:**
  - La importación JSON masiva sobrescribe descripciones. Los scripts de seed JSON tendrán que prepararse de forma exacta según los requerimientos del DNP.

### 2026-09-16 - Antigravity - Corrección de errores de compilación de TypeScript (TS2345, TS6133)

- **Objetivo:** Corregir errores de compilación TypeScript surgidos al hacer obligatorios los campos base de la MGA en `CreateProjectPayload`.
- **Archivos modificados:**
  - `starter/frontend/src/components/Tenant/CreateProjectModal.tsx` - Eliminadas importaciones sin usar (`api`, `Region`).
  - `starter/frontend/src/lib/auroraActionDispatcher.ts` - Añadidos valores por defecto MGA a la creación del proyecto.
  - `starter/frontend/src/pages/tenant/CatalogPage.tsx` - Añadidos valores por defecto MGA a la creación del proyecto.
  - `starter/frontend/src/store/projectStore.test.ts` - Añadidos datos ficticios MGA a los mocks de creación para satisfacer los tests.
- **Logica implementada:**
  - Se inyectaron payloads por defecto para los campos requeridos (`proceso_id`, `objeto`, `localizaciones`, `tipo_inversion`, `tipologia`) en los flujos alternativos (Catálogo y Asistente IA) y en las pruebas, para que TypeScript reanude la compilación correctamente.
- **Dependencias:**
  - Ninguna
- **Validacion ejecutada:**
  - `npx tsc --noEmit` - exitoso (código 0).
- **Decisiones ADR:**
  - No aplica
- **Riesgos y pendientes:**
  - Los campos inyectados en la base de datos (Catálogo y Asistente) son valores predeterminados ("Territorial", "Nacional", etc.) que el usuario deberá editar más tarde en la plataforma, pero permiten que el flujo no se rompa prematuramente.

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
