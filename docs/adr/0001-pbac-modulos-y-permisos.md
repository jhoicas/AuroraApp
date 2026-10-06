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
- [ ] Fase 1: migraciones `tenant_modules`, permisos por acción y asignación a usuarios.
- [ ] Fase 1: middleware `RequirePermission(modulo, accion)` y pruebas de aislamiento entre tenants.
- [ ] Fase 2: gestión de Tenant Admins con invariante del último administrador.
- [ ] Fase 3: UI Super Admin (módulos por alcaldía) y UI Tenant Admin (permisos).

## Referencias

- `starter/backend/cmd/server/main.go`, `starter/backend/internal/interfaces/http/middleware/auth.go`
- `starter/frontend/src/lib/api.ts`
