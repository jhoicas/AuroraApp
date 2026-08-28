# Playwright E2E — AuroraApp (Fase 6)

Suite End-to-End con **Page Object Model**, **Storage State** multi-tenant y
orquestación de **PostgreSQL/pgvector efímero** (Docker) + backend Go real.

## Requisitos

```bash
npm install
npx playwright install          # Chromium, Firefox, WebKit
```

Además para el ciclo de vida real:

- **Docker Desktop** encendido (daemon activo; `docker info` debe responder)
- **Go** en el PATH (seed + build del binario E2E)

## Ciclo de vida (automático)

Al ejecutar Playwright:

1. **`global.setup.ts`** — `docker compose -p aurora-e2e -f starter/docker-compose.e2e.yml up -d --wait`
2. **Migración** — `go run ./cmd/seed` contra `127.0.0.1:5433` (GORM AutoMigrate + admin)
3. **Build** — binario `starter/backend/bin/aurora-e2e[.exe]`
4. **Arranque backend** — binario en `:8081` (espera `/healthz`)
5. **`webServer`** — Vite `:5173` (Playwright lo inicia *antes* del globalSetup)
6. **`global.teardown.ts`** — mata backend + `docker compose … down -v`

```
Frontend :5173  →  Backend :8081  →  Postgres/pgvector :5433
```

## Ejecución

```bash
npm run test:e2e                # 3 navegadores + infra Docker
npm run test:e2e:real           # alias explícito (misma config)
npm run test:e2e:chromium       # solo Chromium
npm run test:e2e:ui
npm run test:e2e:report
```

### Prueba rápida del flujo real

Con Docker Desktop encendido, ejecuta desde la raíz del repositorio:

```powershell
cd starter/frontend
npm run test:e2e:chromium -- e2e/specs/auth-tenant.spec.ts --grep "Backend real"
```

Este comando crea PostgreSQL/pgvector desde cero, ejecuta `AutoMigrate` y el
seed, levanta el backend Go y valida el inicio de sesión real. Al finalizar,
el teardown elimina el backend, el contenedor y su volumen.

### Variables

| Variable | Default | Descripción |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://127.0.0.1:5173` | Origen de la app |
| `E2E_API_URL` | `http://127.0.0.1:8081/api/v1` | API del backend E2E |
| `VITE_E2E` | `true` (vía webServer) | Habilita `/tenant/e2e-crash` para ErrorBoundary |
| `CI` | — | Desactiva `reuseExistingServer` del frontend |

Credenciales estáticas de la BD efímera (Compose):

- User / pass / DB: `e2e_user` / `e2e_pass` / `aurora_e2e`
- `DATABASE_URL`: `postgres://e2e_user:e2e_pass@127.0.0.1:5433/aurora_e2e?sslmode=disable`
- Usuario seed: `admin@aurora.gov.co` / `Admin2026*`

## Flujos críticos

1. **`auth-tenant.spec.ts`**
   - **Backend real:** login Super Admin sin mocks → `/admin/tenants` (golpea Postgres).
   - **Mocks:** Tenant A no ve proyectos ni rutas admin del Tenant B; Storage State en `.auth/`.
2. **`copilot-flow.spec.ts`** — Super Admin → consulta MGA → Action Card → filtro en catálogo (mocks).
3. **`financial-dashboard.spec.ts`** — VPN / TIR, alerta ante 500 y ErrorBoundary (mocks).

Los specs mockeados interceptan `/api/v1/**` y no dependen de Anthropic ni de datos compartidos.

## Estructura

```
e2e/
  .auth/            # Storage State (gitignored *.json)
  fixtures/         # testData + apiMocks
  helpers/          # runCommand, e2eEnv
  pages/            # Login, Dashboard, Copilot, Products, ErrorBoundary
  setup/            # auth.setup.ts (storage state vía mocks)
  specs/            # flujos críticos
  global.setup.ts   # Docker + seed + build
  global.teardown.ts
```

Infra compartida (fuera de `frontend/`):

```
starter/docker-compose.e2e.yml
starter/e2e/postgres/init-vector.sql
```

Regla: **cero** `page.waitForTimeout`. Solo aserciones web auto-esperables (`toBeVisible`, `toHaveURL`, `toHaveValue`, …).
