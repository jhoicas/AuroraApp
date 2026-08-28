# AuroraApp

Plataforma multi-tenant de **formulación de proyectos de inversión pública (MGA)** con asistente IA (Aurora Copilot), catálogos DNP, evaluación financiera nativa (VPN/TIR) y panel de auditoría.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Go 1.25 · Fiber · GORM · PostgreSQL/Supabase · pgvector · JWT · Anthropic Claude Haiku |
| Frontend | React 19 · TypeScript · Vite · Tailwind · Zustand · Axios · Recharts · react-window |
| IA | Claude Haiku (`claude-haiku-4-5-20251001`) · Embeddings open-source / mock · RAG con HNSW |
| Tests | Go (`testify`, `httptest`, `-race`) · Vitest + Testing Library + MSW · Playwright E2E |
| Deploy | Docker Compose (frontend `:3001`, backend `:8081`) + Supabase Cloud |

## Estructura del repositorio

```
AuroraApp/
├── docs/                     # Arquitectura, esquemas SQL y prompts de diseño
└── starter/
    ├── backend/              # API Go (Clean Architecture / DDD)
    ├── frontend/             # SPA React
    ├── docker-compose.yml
    └── .env.example
```

## Capacidades principales

- **Multi-tenant SaaS** con aislamiento por `tenant_id` en JWT y middleware RBAC.
- **Roles:** `SUPER_ADMIN`, `TENANT_ADMIN`, `FORMULADOR`, `EVALUADOR`, `ANALISTA`, `VIEWER`.
- **Catálogos maestros DNP:** sectores, programas, productos, EDT, entregables, actividades, ODS (CRUD + importación masiva).
- **Formulación de proyectos** con presupuesto, detalle MGA y resumen ejecutivo.
- **Evaluación financiera** en Go (`CalculateVPN` / `CalculateTIR`) expuesta en `POST /api/v1/projects/{id}/evaluate`.
- **Aurora Copilot:** chat con RAG (pgvector), Action Cards que filtran catálogos, AbortController y telemetría asíncrona.
- **Panel de auditoría IA** (usage logs + chat) con scroll infinito.
- **ErrorBoundary** en layouts admin/tenant.
- **Refresh JWT** automático vía interceptores Axios.

## Arranque rápido

### 1. Requisitos

- Go **1.25+**
- Node.js **20+**
- PostgreSQL / Supabase (con pgvector recomendado)
- Docker (opcional, para Compose o tests `-race`)

### 2. Backend

```bash
cd starter/backend
cp .env.example .env
# Completa DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY

go mod tidy
go run ./cmd/seed          # crea Super Admin: admin@aurora.gov.co / Admin2026*
go run ./cmd/server        # http://localhost:8080
```

### 3. Frontend

```bash
cd starter/frontend
# Crea .env con al menos:
# VITE_API_URL=http://localhost:8080/api/v1

npm install
npm run dev                # http://localhost:5173
```

### 4. Docker Compose

```bash
cd starter
cp .env.example .env
cp backend/.env.example backend/.env
# Configura DATABASE_URL (Supabase), VITE_API_URL, CORS_ORIGINS y secretos

docker compose up --build -d
# Frontend: http://localhost:3001  (→ contenedor :80)
# Backend:  http://localhost:8081  (→ contenedor :8080)

# Primera vez: crear Super Admin (contra Supabase)
cd backend
go run ./cmd/seed
```

## Rutas de la aplicación

| Ruta | Acceso |
|------|--------|
| `/login`, `/register` | Público |
| `/admin/*` | Solo `SUPER_ADMIN` (tenants, catálogos, IA, settings) |
| `/tenant/projects` | Usuarios de tenant (dashboard + VPN/TIR) |
| `/tenant/projects/:id` | Formulación / presupuesto / resumen |
| `/tenant/catalog`, `/tenant/ai` | Catálogo DNP y asistente del tenant |

## API (prefijo `/api/v1`)

| Grupo | Endpoints clave |
|-------|-----------------|
| Auth | `POST /auth/login`, `/auth/register`, `/auth/refresh` |
| Admin | `GET\|POST /admin/tenants`, `PATCH .../status` |
| Projects | CRUD proyectos, presupuesto, `POST /projects/{id}/evaluate`, `GET /projects/evaluations/summary` |
| Catalog | Sectores, programas, productos, EDT, entregables, actividades, ODS + imports |
| AI | `/ai/aurora/chat`, `/ai/knowledge/*`, `/ai/audit/*`, telemetría |

## Testing

### Backend

```bash
cd starter/backend
go test ./...
# Detector de carreras (requiere CGO; en Windows usar Docker):
docker run --rm -v "${PWD}:/src" -w /src golang:1.25-bookworm go test -v -race ./...
# Cobertura por fases:
./scripts/coverage.ps1
```

Cobertura destacada: finanzas (~96%), servicios de dominio (~94%), middleware (~98%), evaluación de proyectos (100%).

### Frontend — unitario / integración

```bash
cd starter/frontend
npm run test              # Vitest
npm run test:coverage     # umbral ≥90% (stores, lib, Copilot, dashboard, ErrorBoundary)
```

Estado reciente: **~99% statements / ~97% branches / 100% functions** en el scope instrumentado.

### Frontend — E2E (Playwright)

```bash
cd starter/frontend
npx playwright install    # solo la primera vez
npm run test:e2e          # Chromium + Firefox + WebKit
npm run test:e2e:chromium
npm run test:e2e:ui
```

Flujos críticos:

1. **Aislamiento multi-tenant** (`auth-tenant.spec.ts`) — Storage State en `e2e/.auth/`.
2. **Ciclo Aurora Copilot** (`copilot-flow.spec.ts`) — consulta → Action Card → filtro de productos.
3. **Dashboard financiero + ErrorBoundary** (`financial-dashboard.spec.ts`) — VPN/TIR en COP y recuperación ante fallos.

Detalle: [`starter/frontend/e2e/README.md`](starter/frontend/e2e/README.md).

## Variables de entorno

### Backend (`starter/backend/.env`)

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | Postgres/Supabase (sin fallback) |
| `JWT_SECRET` | Sí | Firma de access/refresh tokens |
| `ANTHROPIC_API_KEY` | Sí (chat) | API key de Anthropic |
| `ANTHROPIC_MODEL` | No | Default `claude-haiku-4-5-20251001` |
| `EMBEDDING_PROVIDER` | No | `mock` u otro provider open-source |
| `PORT` | No | Default `8080` |

### Frontend (`starter/frontend/.env`)

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | Base del API, ej. `http://localhost:8080/api/v1` |
| `VITE_E2E` | `true` solo en Playwright (habilita `/tenant/e2e-crash`) |

## Arquitectura (resumen)

```
Frontend (React/Zustand)
    │  Axios + JWT refresh
    ▼
HTTP Handlers (Fiber) ── DTOs + validator
    │
Application (casos de uso: project evaluate, …)
    │
Domain (models, finance, telemetry channels, MGA XML parser, embeddings)
    │
Infrastructure (Postgres/pgvector, Anthropic client)
```

Principios aplicados: DI por interfaces, Repository, Factory de embeddings, telemetría no bloqueante por channels, sanitización XSS y consultas parametrizadas (GORM).

## Documentación adicional

- [`docs/`](docs/) — análisis de arquitectura, esquema SQL y prompts de diseño.
- [`starter/backend/README.md`](starter/backend/README.md) — detalle del API Go.
- [`starter/frontend/README.md`](starter/frontend/README.md) — SPA, scripts y tests.
- [`starter/frontend/e2e/README.md`](starter/frontend/e2e/README.md) — Playwright.

## Licencia / uso

Proyecto interno de formulación MGA. Configura secretos solo en `.env` locales (nunca en el repositorio).
