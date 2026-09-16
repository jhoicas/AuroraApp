# Estandares Senior de React y Supabase

## React y TypeScript

- Mantiene componentes pequenos y orientados a una responsabilidad; separa presentacion, composicion y acceso a datos.
- Usa TypeScript estricto, tipos de dominio compartidos y estados discriminados para loading, success y error. Evita `any` salvo una frontera documentada.
- Los hooks encapsulan efectos y acceso a APIs; no pongas reglas de negocio complejas dentro del JSX.
- Separa estado de servidor, estado global de aplicacion y estado local de UI. Usa Zustand solo para estado global estable y evita duplicar la misma fuente de verdad.
- Cancela solicitudes al desmontar o cambiar de contexto, maneja errores visibles y evita actualizaciones sobre componentes obsoletos.
- Usa componentes accesibles, navegacion por teclado, labels explicitos, foco visible y mensajes de error comprensibles.
- No expongas claves secretas en variables `VITE_*`; solo usa la clave publica/publishable de Supabase en el navegador.

## Supabase y PostgreSQL

- Cada tabla del esquema expuesto debe tener RLS habilitado y politicas explicitas para `anon` y `authenticated` segun el caso.
- RLS debe autorizar por identidad y pertenencia al tenant, no solo por `TO authenticated`. Usa `auth.uid()` y una relacion segura con `tenant_id`.
- En `INSERT`, `UPDATE` y `UPSERT` valida `WITH CHECK`; en `UPDATE`, define tambien la politica `SELECT` necesaria.
- Nunca uses `user_metadata` para autorizacion. Los roles y permisos deben provenir de `app_metadata`, tablas protegidas o funciones seguras.
- Las vistas expuestas deben preservar RLS, preferiblemente con `security_invoker = true` en PostgreSQL compatible.
- Evita `SECURITY DEFINER` salvo necesidad justificada; limita schema, privilegios, `search_path` y permisos de ejecucion.
- No uses `service_role` ni claves secretas en frontend. Las operaciones privilegiadas deben vivir en backend o Edge Functions protegidas.
- Toda tabla tenant-scoped debe tener `tenant_id`, indice apropiado y politicas que impidan leer, mover o borrar filas de otro tenant.
- Usa migraciones versionadas, lockfiles comprometidos y versiones fijadas para dependencias de Supabase.

## Validacion

- Prueba lecturas, escrituras, actualizaciones, eliminaciones y casos cross-tenant con roles reales o fixtures equivalentes.
- Verifica que una ausencia de autorizacion no se confunda con una lista vacia y que los errores no filtren informacion sensible.
- Revisa politicas, grants, funciones, triggers y vistas despues de cualquier cambio de esquema.
- En frontend, prueba estados de carga, error, permisos, sesion expirada y cambio de tenant.
