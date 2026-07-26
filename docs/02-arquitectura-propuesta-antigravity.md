# Propuesta de arquitectura para la nueva plataforma

## 1. Objetivo del sistema
Construir una plataforma para gestión de inversión pública con:
- formulación de proyectos
- módulo de identificación, preparación, evaluación y programación
- catálogo de productos, sectores, programas, subprogramas, ODS y EDT
- asistente IA llamado Aurora
- multi-tenant para municipios, gobernaciones y entidades territoriales

## 2. Arquitectura propuesta
### Frontend
- React + Vite + TypeScript
- Tailwind + shadcn/ui
- React Query para estado de servidor
- rutas separadas por rol: superadmin, entidad territorial, formulador, evaluador

### Backend
- Go + Fiber
- Clean Architecture
- módulos por dominio:
  - auth
  - tenants/organizations
  - users/roles/permissions
  - catalogs
  - projects
  - workflows
  - ai-assistant
  - integrations

### Base de datos
- PostgreSQL/Supabase
- cada tabla con tenant_id cuando aplique
- RLS por tenant
- jsonb para metadatos flexibles

## 3. Modelo de negocio clave
### Superadmin global
Gestiona:
- entidades territoriales / tenants
- usuarios maestros
- catálogos base del Estado
- parametrización de sectores, programas, productos, ODS y EDT
- políticas de acceso y módulos del sistema

### Empresa / tenant / entidad territorial
Representa una entidad como un municipio o una gobernación.
Puede tener:
- usuarios propios
- proyectos de inversión
- formularios y flujos de aprobación
- documentos, evidencias y estados

## 4. Módulos funcionales recomendados
1. Administración del ecosistema
   - gestión de entidades territoriales
   - gestión de usuarios
   - planes, licenciamiento y suscripciones
2. Catálogos base
   - sectores
   - programas y subprogramas
   - productos
   - EDT
   - entregables
   - actividades
   - ODS
3. Formulación de proyectos
   - identificación de problema
   - árbol de problemas y objetivos
   - participantes y focalización
   - alternativas de solución
4. Preparación y viabilidad
   - selección de productos del catálogo
   - desagregación de EDT
   - validaciones normativas
5. IA Aurora
   - asistente de formulación
   - propuesta inicial de árbol de problemas/objetivos
   - recomendación de productos y actividades
   - validación semántica y léxica

## 5. Flujo recomendado para el menú superadmin
- Superadmin crea una entidad territorial
- Asigna usuarios y roles
- Habilita módulos permitidos
- Carga o sincroniza catálogos oficiales
- Controla configuración global y observabilidad

## 6. Recomendación de arquitectura de seguridad
- roles explícitos: super_admin, tenant_admin, analyst, formulador, evaluator, viewer
- permisos por módulo y por entidad territorial
- políticas RLS para evitar fuga entre tenants
- logs de auditoría para cada acción crítica
