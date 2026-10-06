import type { ReactElement } from 'react';
import { Navigate, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import type { AccessModule } from '../store/accessStore';
import { moduleRegistry, registeredModules, type RegistryEntry } from './moduleRegistry';

/**
 * Rutas hijas del layout (/tenant o /admin) generadas desde el árbol de módulos visibles.
 * Cada módulo con UI registrada aporta sus rutas, envueltas en un guard `module` + `view`.
 * Los códigos sin registro se omiten con una advertencia en consola (no rompen la UI).
 */
export function buildModuleRoutes(
  nav: AccessModule[],
  registry: Record<string, RegistryEntry> = moduleRegistry,
): ReactElement[] {
  const out: ReactElement[] = [];
  for (const { node, entry } of registeredModules(nav, registry)) {
    const routes = entry.routes ?? [];
    if (routes.length === 0) continue;
    out.push(
      <Route key={node.code} element={<ProtectedRoute module={node.code} action="view" />}>
        {routes.map((r) => {
          const Page = r.Component;
          if (!Page) {
            return <Route key={r.path} path={r.path} element={<Navigate to={r.redirectTo ?? '/'} replace />} />;
          }
          return <Route key={r.path} path={r.path} element={<Page />} />;
        })}
      </Route>,
    );
  }
  return out;
}
