# AuroraApp — Frontend

SPA de formulación MGA multi-tenant. **React 19 + TypeScript + Vite + Tailwind + Zustand**.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Vite en `http://localhost:5173` |
| `npm run build` | `tsc -b` + build de producción |
| `npm run preview` | Sirve el build |
| `npm run lint` | Oxlint |
| `npm run test` | Vitest (unitario + integración UI) |
| `npm run test:coverage` | Cobertura v8 (umbral ≥90%) |
| `npm run test:e2e` | Playwright (Chromium, Firefox, WebKit) |
| `npm run test:e2e:chromium` | Solo Chromium |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:e2e:report` | Abre el reporte HTML |

## Arranque

```bash
# .env (mínimo)
# VITE_API_URL=http://localhost:8080/api/v1

npm install
npm run dev
```

Con Docker Compose (desde `starter/`): frontend en `http://localhost:3001` (Nginx sirviendo el build).

## Estructura

```
src/
  components/
    AuroraCopilot/       # Chat flotante + Action Cards
    ErrorBoundary.tsx
    Login/ Register/
    Tenant/              # Presupuesto, resumen, modales
    admin/               # Auditoría IA, detalle de catálogos
  context/AuthContext.tsx
  layouts/               # SuperAdminLayout, TenantLayout (+ ErrorBoundary)
  lib/                   # api (Axios+refresh), roles, financialFormat
  pages/
    admin/               # Tenants, catálogos, AI Knowledge
    tenant/              # Dashboard, detalle proyecto, catálogo, asistente
  store/                 # Zustand (copilot, projects, catalog, AI, tenants…)
  test/                  # setup Vitest, MSW, renderWithProviders
e2e/                     # Playwright POM + Storage State
playwright.config.ts
vitest.config.ts
```

## Roles y navegación

| Rol | Home |
|-----|------|
| `SUPER_ADMIN` | `/admin/tenants` |
| Resto con `tenant_id` | `/tenant/projects` |

Guards en `ProtectedRoute` + `lib/roles.ts`. El token y el usuario viven en `localStorage` (`aurora_token`, `aurora_refresh_token`, `aurora_user`).

## Features UI

- **Aurora Copilot:** panel flotante (admin), historial virtualizado, “Aurora está escribiendo…”, Detener (AbortController), Limpiar chat, Action Cards → `applyCopilotSearch` + navegación al catálogo.
- **Dashboard de proyectos:** stats, gráfico Recharts VPN/TIR y tabla accesible con formato COP / porcentaje.
- **Catálogos admin:** búsqueda, paginación, importadores, sync con Action Cards vía `useCopilotSearchSync`.
- **Auditoría IA:** tabs usage/chat con IntersectionObserver (scroll infinito).
- **ErrorBoundary** por layout; se reinicia al cambiar de ruta (`key={pathname}`).

## Estado global (Zustand)

| Store | Responsabilidad |
|-------|-----------------|
| `auroraCopilotStore` | Chat, session_id, typing, clearChat, cancelGeneration |
| `projectStore` | Proyectos, presupuesto, evaluación, summary VPN/TIR |
| `catalogStore` | Catálogos + `applyCopilotSearch` / `consumeCopilotSearch` |
| `aiKnowledgeStore` | Grafo + ingest XML |
| `aiStore` | Chat legacy del tenant |
| `tenantStore` | CRUD/estado de tenants (admin) |

Tipado estricto: sin `any` en los stores de Copilot y Knowledge.

## API client

`src/lib/api.ts`:

- Base URL desde `VITE_API_URL`.
- Adjunta Bearer en cada request.
- Ante **401**, intenta refresh; si falla, dispara logout.
- Ante **403**, registra warning.

## Tests

### Unitario / integración (Vitest)

```bash
npm run test
npm run test:coverage
```

Incluye stores, interceptores Axios, Copilot, Action Cards, ProjectsDashboard, ErrorBoundary. MSW intercepta `/api/v1/**`. El setup falla el test si aparece `not wrapped in act(`.

### E2E (Playwright)

```bash
npx playwright install
npm run test:e2e
```

- Page Object Model en `e2e/pages/`.
- Storage State multi-tenant en `e2e/.auth/` (generado por `auth.setup.ts`).
- Specs: aislamiento de tenant, ciclo Copilot, dashboard financiero + ErrorBoundary.
- Sin `page.waitForTimeout`; solo aserciones auto-esperables.

Ver [`e2e/README.md`](e2e/README.md).

## Build

```bash
npm run build
# salida en dist/
```
