# AuroraApp — Backend

API REST en **Go 1.25** con Clean Architecture / DDD. Sirve autenticación JWT, multi-tenant, catálogos DNP, proyectos MGA, evaluación financiera (VPN/TIR), Aurora Copilot (RAG + Anthropic) y auditoría de uso de IA.

Módulo Go: `aurora-backend`.

## Estructura

```
cmd/
  server/                 # entrypoint HTTP
  seed/                   # Super Admin inicial
internal/
  domain/
    models/               # entidades GORM
    constants/            # roles, estados, AI
    services/             # telemetría async, parser XML MGA, embeddings
  application/
    project/              # evaluación VPN/TIR
  infrastructure/
    persistence/postgres/ # repos, imports, pool, HNSW
    llm/                  # cliente Anthropic
  interfaces/http/
    handlers/             # controladores + DI por interfaces
    middleware/           # JWT, RBAC, rate limit
    router/               # montaje de rutas
    dto/                  # request/response + go-playground/validator
  config/
pkg/
  finance/                # CalculateVPN / CalculateTIR
scripts/
  coverage.ps1            # cobertura por fases (≥90%)
```

## Requisitos

- Go 1.25+
- PostgreSQL / Supabase (pgvector recomendado para RAG)
- Variables en `.env` (copia desde `.env.example`)

```bash
cp .env.example .env
```

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | **Obligatoria.** Sin fallback: el proceso aborta si falta. |
| `JWT_SECRET` | Firma de tokens |
| `ANTHROPIC_API_KEY` | Chat Aurora |
| `ANTHROPIC_MODEL` | Default `claude-haiku-4-5-20251001` |
| `EMBEDDING_PROVIDER` | `mock` u open-source |
| `PORT` | Default `8080` |

## Arranque

```bash
go mod tidy
go run ./cmd/seed      # admin@aurora.gov.co / Admin2026*
go run ./cmd/server    # http://localhost:8080
```

Con Docker Compose (desde `starter/`):

```bash
docker compose up --build -d
# Frontend: http://localhost:3001
# Backend:  http://localhost:8081
```

La base de datos es **Supabase Cloud**; configura `DATABASE_URL` en `backend/.env` con `sslmode=require`.

## Dominio de datos

| Entidad | Tabla | Multi-tenant |
|---------|-------|--------------|
| Role | `roles` | Global |
| Tenant | `tenants` | N/A |
| User | `users` | `tenant_id` nullable (`NULL` = SUPER_ADMIN) |
| Project / Budget / Evaluation | `projects`, … | Obligatorio |
| Knowledge graph | `ai_knowledge_nodes/links` | + embedding HNSW |
| Chat / Usage | `ai_chat_messages`, `ai_usage_logs` | Auditoría |

Roles canónicos: `SUPER_ADMIN`, `TENANT_ADMIN`, `FORMULADOR`, `EVALUADOR`, `ANALISTA`, `VIEWER`.

## Endpoints (`/api/v1`)

### Auth
- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/refresh`

### Admin (SUPER_ADMIN)
- `GET|POST /admin/tenants`
- `PATCH /admin/tenants/{id}/status`

### Projects (tenant)
- CRUD proyectos y presupuesto
- `POST /projects/{id}/evaluate` — VPN/TIR nativos en Go
- `GET /projects/evaluations/summary`

### Catalog
- Sectores, programas, productos, EDT, entregables, actividades, ODS
- Endpoints de importación masiva (CSV/XLSX)

### AI
- `POST /ai/aurora/chat` — RAG + Claude Haiku + Action Cards (rate limited)
- `POST /ai/knowledge/ingest` — XML MGA → grafo + embeddings
- `GET /ai/knowledge/graph`
- `GET /ai/audit/usage`, `GET /ai/audit/chat`
- Telemetría asíncrona por channel (no bloquea la respuesta HTTP)

## Seguridad y rendimiento

- JWT estricto (`token_type`, expiración, UUIDs, roles).
- Rate limiting por usuario (`golang.org/x/time/rate`) en chat Aurora.
- Validación de DTOs con `go-playground/validator`.
- Consultas parametrizadas (GORM) — prevención de SQL injection.
- Connection pool: `MaxOpenConns=100`, `MaxIdleConns=20`, `ConnMaxLifetime=1h`.
- Índice HNSW sobre embeddings para búsqueda coseno.

## Tests

```bash
go test ./...
go test -v -cover ./...

# Race detector (CGO). En Windows sin gcc:
docker run --rm -v "${PWD}:/src" -w /src golang:1.25-bookworm go test -v -race ./...

# Cobertura por fases (umbral 90% en archivos objetivo):
./scripts/coverage.ps1
```

Stack de testing: `testing` + `testify` + `httptest` + mocks por structs/interfaces. Table-Driven Tests en finanzas, telemetría, XML, handlers y middleware.

## Build

```bash
CGO_ENABLED=0 go build -o bin/aurora-backend ./cmd/server
```
