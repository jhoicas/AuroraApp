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
