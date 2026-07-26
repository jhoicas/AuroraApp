# Prompt listo para pedirle a una IA que construya algo similar

Usa este prompt en un asistente de código:

"Construye una plataforma SaaS multi-tenant para gestión de inversión pública inspirada en la arquitectura de System Travels. Reutiliza el patrón de backend Go + Fiber, frontend React + Vite + TypeScript, PostgreSQL/Supabase con RLS y roles por tenant.

Requisitos:
1. Debe existir un superadmin global que administre empresas/tenants, usuarios, planificaciones, catálogos base y configuraciones globales.
2. Cada empresa/tenant debe tener su propio espacio aislado, con usuarios propios, proyectos y flujos.
3. Debe existir un menú de superadmin con módulos para: Empresas, Usuarios, Catálogos, Configuración, Reportes y Seguridad.
4. Debe existir un panel por tenant con módulos para: Proyectos, Formularios, Catálogo, IA asistente, Flujos y Reportes.
5. Debe soportar un catálogo de inversión con: Sectores, Programas, Subprogramas, Productos, Indicadores, ODS, EDT, Entregables y Actividades.
6. El catálogo debe poder cargarse desde un archivo Excel llamado CATALOGO_DE_PRODUCTOS.xlsx.
7. Debe incluir un asistente de IA llamado Aurora que ayude a formular proyectos a partir de texto libre, sugiera árbol de problemas/objetivos y recomiende productos del catálogo.
8. Debe haber roles como: super_admin, tenant_admin, formulador, evaluador, analista y viewer.
9. Debe haber aislamiento total entre tenants, con políticas de seguridad por tenant_id.
10. Entrega una estructura de carpetas limpia y escalable, con README, arquitectura, migraciones SQL y un esqueleto de frontend y backend listo para continuar."

## Sugerencia extra
Si quieres obtener una respuesta mejor, añade:
- la tecnología exacta
- la estructura de roles
- los módulos iniciales que deben existir
- si quieres empezar con una versión MVP o con una versión completa
