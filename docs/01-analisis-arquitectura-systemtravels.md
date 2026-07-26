# Análisis de la arquitectura actual de System Travels

## 1. Visión general
System Travels está construida como una plataforma SaaS B2B multi-tenant con:
- un backend en Go con arquitectura limpia
- un frontend en React + Vite + TypeScript
- PostgreSQL/Supabase con RLS
- un modelo de usuarios y permisos orientado a empresas/tenants
- un superadmin global que administra el ecosistema

## 2. Patrón general del sistema
### Backend
La API está separada por capas:
- delivery/http: routers, handlers y middleware
- usecase: reglas de negocio
- repository/postgres: acceso a datos
- domain: modelos y reglas del negocio
- infrastructure: auth, email, auditoría, integraciones externas

Este patrón permite aislar el transporte HTTP del núcleo de negocio y mantener la lógica reutilizable.

## 3. Multi-tenant
El sistema organiza la información por tenant. Cada tenant representa una empresa o agencia.

Los elementos clave son:
- tenants: empresas del ecosistema
- profiles: usuarios asociados a un tenant o al superadmin global
- tenant_modules: módulos habilitados para cada tenant
- tenant_id: campo transversal que limita la visibilidad a la empresa correspondiente

## 4. Superadmin
El superadmin no vive dentro de un tenant. Tiene acceso a:
- administración de tenants/empresas
- usuarios de cada empresa
- planes, precios y suscripciones
- branding y configuraciones globales
- reportes y observabilidad

## 5. Frontend
El frontend usa React Router con rutas protegidas y layouts diferenciados:
- superadmin: rutas bajo /super-admin
- tenant: rutas bajo /app
- onboarding para crear o entrar a un tenant

La lógica de permisos se centraliza principalmente en:
- AuthContext
- ProtectedRoute
- ModuleRouteGuard
- TenantModulesContext

## 6. Lo que se puede reutilizar para el nuevo sistema
Para la nueva plataforma de inversión pública, la misma arquitectura sigue siendo válida, pero cambiando el dominio:
- en vez de reservas, viajes y pagos, se manejarán proyectos, formulación, catálogo, EDT y flujos de inversión
- el tenant pasa a ser una entidad territorial o institución
- el superadmin gestiona entidades, usuarios, políticas, catálogos base y licenciamiento
