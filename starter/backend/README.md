# AuroraApp — Backend

Clean Architecture / hexagonal. Módulo: `aurora-backend`.

## Estructura

```
cmd/server/                         # entrypoint
internal/
  domain/
    models/                         # entidades GORM (Paso 1 ✅)
    constants/                      # roles y estados
  application/                      # casos de uso (auth, tenant, project, ailog)
  infrastructure/
    persistence/postgres/           # GORM + conexión
    auth/                           # JWT
    security/                       # bcrypt, headers
  interfaces/http/
    handlers/                       # controladores
    middleware/                     # JWT + RBAC + tenant isolation
    router/                         # rutas
    dto/                            # request/response + validator tags
  config/
pkg/response/                       # respuestas HTTP estándar
migrations/                         # SQL versionado (opcional junto a AutoMigrate)
```

## Modelos (Paso 1)

| Modelo   | Tabla     | `tenant_id`                         |
|----------|-----------|-------------------------------------|
| Role     | roles     | No (global)                         |
| Tenant   | tenants   | N/A                                 |
| User     | users     | Nullable (NULL = SUPER_ADMIN)       |
| Project  | projects  | Obligatorio                         |
| AILog    | ai_logs   | Obligatorio                         |

## Próximos pasos

- Paso 2: Conexión PostgreSQL + Auth JWT + middleware RBAC
- Paso 3: CRUD Tenants (solo SUPER_ADMIN)
- Paso 4–5: Frontend React + integración login
