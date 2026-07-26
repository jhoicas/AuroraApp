# AuroraApp Blueprint

Esta carpeta reúne una propuesta de arquitectura reutilizable para un nuevo sistema de inversión pública basado en la experiencia de System Travels.

## Qué incluye
- Análisis de cómo está construida la app actual.
- Propuesta de arquitectura para la nueva plataforma multi-tenant.
- Modelo de datos para superadmin, empresas/tenants, usuarios y catálogo de inversión.
- Prompt listo para pedirle a otra IA que construya una app similar.
- Esqueleto inicial de backend/frontend para arrancar rápido.

## Objetivo
Reutilizar el patrón de:
- backend Go + Fiber
- frontend React + Vite + TypeScript
- PostgreSQL/Supabase con RLS
- multi-tenant por tenant/empresa
- superadmin global
- módulos por empresa y roles
- IA asistente con base de conocimiento y catálogo de productos

## Estructura
- docs/: arquitectura, modelo de datos, prompts e ingesta del catálogo.
- starter/: esqueleto inicial para backend y frontend.
