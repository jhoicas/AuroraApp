# ADR-0001: Control de acceso por permisos (PBAC) y módulos por tenant

- **Estado:** Aceptada (Fase 0 implementada; Fases 1+ pendientes)
- **Fecha:** 2026-10-06
- **Autores:** Claude (sesión con el product owner)
- **Alcance:** Backend | Frontend | Datos | Seguridad
- **Reemplaza:** Ninguno

## Contexto

La autorización actual es solo por rol (`RequireRole`) más aislamiento por `tenant_id` del JWT. No permite
dar acceso parcial a un usuario ni habilitar/deshabilitar funcionalidades por alcaldía. Antes de construir el
modelo de permisos se auditó la superficie existente (Fase 0) y se encontró:

- Rutas legacy (`/api/admin/catalog/upload`, `/api/catalog/upload`, `/api/tenant/*`) registradas en
  `cmd/server/main.go`. Las dos primeras no tenían autenticación; `/api/tenant/*` usaba un middleware stub que
  aceptaba cualquier `Bearer` y fijaba `tenant_id = "mock-tenant-id"`.
- `CatalogImporter` con `variant="pnd"` caía en la rama legacy sin autenticación en lugar de `/api/v1/catalog/pnd/import`.
- Access token con TTL de 24 h.
- `/api/v1/auth/*` (públicos) sin límite de peticiones.
- `JWT_SECRET` con valor por defecto inseguro aceptado también en producción.

## Decision

Decisiones del product owner (D1–D6):

1. **D1 — Permisos por acción.** Cada módulo expone `view`, `create`, `edit`, `delete`.
2. **D2 — `tenant_modules`.** Tabla que indica qué módulos están habilitados por tenant; la administra el
   SUPER_ADMIN. Un módulo deshabilitado para el tenant niega acceso a todos sus usuarios, sin importar permisos.
3. **D3 — Tenant Admin crea Tenant Admins.** Invariante: no se puede desactivar, degradar ni eliminar al último
   Tenant Admin activo de un tenant (validado en servicio y en transacción).
4. **D4 — Fase 0 previa.** Limpiar rutas legacy y endurecer endpoints antes de construir PBAC.
5. **D5 — Access token de 1 hora**, apoyado en el refresh token (7 días) ya existente.
6. **D6 — Granularidad MGA = 5 etapas principales** (identificación, preparación, evaluación, programación,
   presentar). No se controlan sub-tabs en esta iteración.

Regla de evaluación (Fase 1): `permitido = módulo habilitado en tenant_modules ∧ permiso(acción) otorgado al
usuario (vía rol/perfil)`; SUPER_ADMIN omite el chequeo de tenant. Todo endpoint nuevo declara módulo+acción.

## Alternativas consideradas

1. **Solo roles fijos** - simple, pero no cubre acceso parcial ni módulos por alcaldía. Descartada.
2. **Permisos solo en el frontend** - inseguro; el backend debe ser la fuente de verdad. Descartada.
3. **Permisos a nivel sub-tab MGA** - mayor granularidad, mucho mayor costo de mantenimiento. Diferida (D6).

## Consecuencias

### Positivas

- Superficie de ataque menor al eliminar rutas legacy sin autenticación.
- Ventana de robo de token reducida de 24 h a 1 h.
- Base clara para PBAC con aislamiento por tenant y control de módulos centralizado.

### Negativas o riesgos

- Con TTL de 1 h, el frontend depende del refresh automático (`src/lib/api.ts`); un fallo de refresh cierra sesión.
- Los tokens ya emitidos con 24 h siguen válidos hasta expirar (no hay revocación server-side).
- El rate limit es en memoria por proceso (no compartido entre réplicas).

## Seguridad y multi-tenancy

- **RLS/autorización:** `tenant_id` siempre del JWT, nunca del cuerpo/headers. PBAC se evalúa en middleware.
- **Secretos/datos sensibles:** con `APP_ENV=production` el servidor no arranca sin `JWT_SECRET` propio.
- **Auditoría:** cambios de permisos, módulos y administradores deben registrarse (Fase 1+).

## Plan de implementacion y validacion

- [x] Fase 0: eliminar rutas/handlers/middleware legacy del backend y componentes huérfanos del frontend.
- [x] Fase 0: PND importa por `/api/v1/catalog/pnd/import` (autenticado).
- [x] Fase 0: access token a 1 h (`AccessTokenTTL`), rate limit en login/register/refresh, fail-fast de `JWT_SECRET` en producción.
- [x] Validación Fase 0: `go build ./...`, `go test ./...`, `tsc -b`, `vitest`.
- [x] Fase 1: modelos GORM `Module`, `TenantModule`, `RoleModuleDefault`, `UserModulePermission`, `AccessAuditLog` (en `AllModels()`, migración aditiva por AutoMigrate), manifiesto declarativo con `SeedVersion` (`internal/domain/modules`) y `EnsureModulesSeed` en el arranque, con backfill.
- [x] Fase 2: `access.Service` (`Resolve`, `Can`, `ValidateSession`, caché 30 s), `RequirePermission`, `TenantTargetGuard`, `GET /api/v1/auth/me/access`, `PBAC_ENFORCE` (off|log|enforce; por defecto `log`) aplicado a todas las rutas de negocio.
- [ ] Fase 2b: pasar `PBAC_ENFORCE=enforce` tras revisar el log de dry-run.
- [x] Fase 3 (API Super Admin): `/api/v1/admin/modules` (CRUD + `PUT /order`), `/admin/tenants/:tenantId/users` y `/modules`, `/admin/users/:id/permissions|password|status`, con auditoría e invalidación de caché; `PATCH /projects/:id` autorizado por contenido.
- [x] Fase 4 (API Tenant Admin): `/api/v1/tenant/users` (GET/POST, GET/PATCH `:id`, `PUT :id/password`, `PATCH :id/status`, GET/PUT `:id/permissions`) y `GET /api/v1/tenant/modules/assignable`, con `ActorPolicy` y `TenantTargetGuard`.
- [ ] Fase 5: frontend (menú por `/auth/me/access`, pantallas Super Admin y Tenant Admin) y paso a `PBAC_ENFORCE=enforce`.
- [ ] Fase 3: UI Super Admin (módulos por alcaldía) y UI Tenant Admin (permisos).

## Esquema y seeding (Fase 1)

- `modules(code único, kind MODULE|SECTION, scope TENANT|PLATFORM, parent_id, route, sort_order, is_active, seed_version)`.
  La MGA es un MODULE con 5 SECTION (D6). Los módulos PLATFORM son solo de SUPER_ADMIN y no se asignan a tenants.
- `tenant_modules(tenant_id, module_id único, is_enabled)`, `role_module_defaults(role_id, module_id único, can_view/create/edit/delete)`,
  `user_module_permissions(user_id, module_id único, can_*, granted_by)`, `access_audit_logs` (sin FKs duras).
- `EnsureModulesSeed` es idempotente y no destructivo: solo re-sincroniza módulos con `seed_version` menor; retira
  módulos desactivándolos; habilita los módulos TENANT para tenants sin fila (nunca reactiva uno deshabilitado);
  y copia los defaults de rol a usuarios no admin sin fila, solo para módulos nuevos/modificados (no pisa permisos
  ya configurados). Defaults: todo rol no admin conserva `view` en todos los módulos (salvo `users`, solo TENANT_ADMIN).
  Los admins se resuelven por rol y no reciben filas por usuario. Una fila existente, aunque todo `false`, cuenta como configurada.
- Para agregar un módulo: editar `Manifest` y subir `SeedVersion`.

## Núcleo de acceso (Fase 2)

- **Reglas de `Can`:** SUPER_ADMIN permitido por lógica pura (sin leer permisos ni `tenant_modules`). TENANT_ADMIN permitido
  en todo módulo TENANT habilitado para su tenant (D2 aplica también a admins), sin leer `user_module_permissions`. Resto de
  roles: permiso explícito y módulo habilitado. Módulos PLATFORM solo SUPER_ADMIN; módulo desconocido o inactivo, denegado;
  una sección exige que su módulo padre esté habilitado.
- **Caché:** snapshots en memoria por usuario, tenant y catálogo de módulos (TTL 30 s). `Invalidate*` debe llamarse al
  cambiar permisos, módulos o usuarios (Fases 3+); sin invalidar, un cambio tarda hasta 30 s en verse.
- **`token_version`:** columna `users.token_version` (default 0), claim `tv` en access/refresh. `ValidateSession` compara el
  claim con el valor cacheado; `Refresh` también lo exige. Subir el valor revoca sesiones (tras invalidar caché o ≤30 s).
- **Errores estándar:** 403 `{error:"forbidden", code:"PERMISSION_DENIED", module, action, reason}`; 401 `SESSION_REVOKED`;
  503 `ACCESS_CHECK_UNAVAILABLE` (enforce falla cerrado).
- **`PBAC_ENFORCE`:** `log` (defecto) evalúa y registra `[PBAC] dry-run: se denegaría (403) ...` sin bloquear; `enforce`
  bloquea; `off` no evalúa. Sesión revocada y fallos del servicio siguen el mismo modo.
- **Mapeo de rutas:** proyectos/presupuesto → `projects` (GET view, POST create, PUT/PATCH edit, DELETE delete); causas, efectos,
  objetivos, indicadores, participantes, poblaciones, alternativas → `mga.identificacion`; necesidades y cadena de valor EDT →
  `mga.preparacion`; evaluar/auditar → `mga.evaluacion`; reportes → `reports`; IA (chat, sugerencias, historial, grafo) →
  `ai` view; catálogos (lecturas, MGA, ubicaciones, procesos) → `catalog` view; escrituras/importaciones de catálogo →
  `admin.catalogs` (solo SUPER_ADMIN). Un test falla si una ruta de negocio nueva no declara su guard.
- **`TenantTargetGuard`:** recibe un `TenantResolver` (p. ej. `UserTenantResolver(db, "userId")`); SUPER_ADMIN pasa; un objetivo
  de otro tenant responde 404. Siempre activo (no depende de `PBAC_ENFORCE`). Aún sin rutas que lo usen (Fase 3).

## API Super Admin (Fase 3)

- **Módulos:** `IsSystem` (los del manifiesto: no se borran) y `Customized` (se marca al editar o reordenar un módulo de sistema; el
  seed ya no pisa sus campos). Los módulos creados por un SUPER_ADMIN no son de sistema y el seed no los desactiva.
  Sin fila en `tenant_modules` un módulo está habilitado: solo un `false` explícito lo apaga (tenants y módulos nuevos funcionan).
- **Invalidación:** permisos → `Invalidate(userID)`; techo de módulos → `InvalidateTenant`; cambios de módulos → `InvalidateAll`;
  contraseña y estado además incrementan `users.token_version` (revocan sesiones). Todo cambio escribe `access_audit_logs`
  en la misma transacción (sin contraseñas ni hashes en `details`).
- **Reglas:** `create/edit/delete` exigen `view`; los administradores (TENANT_ADMIN/SUPER_ADMIN) no admiten permisos por usuario
  (se resuelven por rol); no se puede desactivar al último TENANT_ADMIN activo de un tenant ni a uno mismo; contraseña mín. 8.
- **`PATCH /projects/:id`:** el guard compara el payload con lo almacenado y exige `edit` solo sobre las etapas cuyo contenido cambia
  (`mga.identificacion|preparacion|evaluacion|programacion|presentar`; columnas `name/description` → `projects`; claves desconocidas →
  `mga`). El frontend no cambia. Limitación: un guardado con snapshot desactualizado cuenta como cambio en etapas ajenas.

## API Tenant Admin (Fase 4)

- **Cadena por ruta:** `RequireAuth → RequireTenant → RequireRole(TENANT_ADMIN) → verificación del actor en BD → TenantTargetGuard (rutas con :id)
  → permiso PBAC del módulo users`. La verificación en BD (usuario activo, rol TENANT_ADMIN, tenant del JWT, `token_version`) corre siempre,
  con independencia de `PBAC_ENFORCE`: es una API privilegiada y un JWT de hasta 1 h no basta tras una degradación.
- **Aislamiento:** un `:id` de otro tenant (o inexistente) responde el mismo 404; el servicio vuelve a comprobar el tenant (defensa en
  profundidad). El `tenant_id` sale siempre del actor; el cuerpo no tiene ese campo y se ignora si llega.
- **`ActorPolicy`:** no se asigna ni promueve a SUPER_ADMIN (403); no se cambia el propio rol ni se desactiva uno mismo (400); no se
  desactiva ni degrada al último TENANT_ADMIN activo (409). Un Tenant Admin sí puede crear otros Tenant Admin (D3). No hay endpoint de borrado.
- **Cambios de rol/contraseña/estado** suben `token_version` y limpian la caché; un cambio de rol a no admin completa los defaults faltantes.
- **Catálogo asignable:** módulos activos, scope TENANT, habilitados en `tenant_modules` del tenant (sin fila = habilitado) y con su padre
  habilitado, excluyendo los no delegables (`users`: la administración de usuarios es solo del rol TENANT_ADMIN). `PUT .../permissions`
  rechaza (400) cualquier módulo fuera de ese catálogo.
- El módulo `users` también cuenta para el techo: si el SUPER_ADMIN lo deshabilita para un tenant, PBAC (en `enforce`) bloquea esta API.

## Referencias

- `starter/backend/cmd/server/main.go`, `starter/backend/internal/interfaces/http/middleware/auth.go`
- `starter/frontend/src/lib/api.ts`
