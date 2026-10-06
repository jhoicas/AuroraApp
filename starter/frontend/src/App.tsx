import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login/Login';
import Register from './components/Register/Register';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import TenantLayout from './layouts/TenantLayout';
import LandingPage from './pages/LandingPage';
import AccessBootstrap from './components/AccessBootstrap';
import { useAccessStore } from './store/accessStore';
import { buildModuleRoutes } from './lib/moduleRoutes';
import { firstNavPath } from './lib/navModules';

/** Solo disponible cuando Vite se arranca con VITE_E2E=true (suite Playwright). */
function E2ECrashPage(): never {
  throw new Error('Fallo E2E controlado para validar ErrorBoundary');
}

function RoutesFallback() {
  return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">Cargando…</div>;
}

/** Ruta no encontrada o módulo no concedido dentro de un layout: al primer módulo navegable. */
function fallbackRoute(home: string | null) {
  return (
    <Route
      path="*"
      element={
        home ? (
          <Navigate to={home} replace />
        ) : (
          <div role="alert" className="p-6 text-gray-600">
            No tienes acceso a esta sección.
          </div>
        )
      }
    />
  );
}

function AppRoutes() {
  // Las rutas de /admin y /tenant se inyectan desde el árbol de módulos del servidor.
  const nav = useAccessStore((s) => s.nav);
  const adminRoutes = buildModuleRoutes(nav.PLATFORM);
  const tenantRoutes = buildModuleRoutes(nav.TENANT);
  const adminHome = firstNavPath(nav.PLATFORM);
  const tenantHome = firstNavPath(nav.TENANT);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<LandingPage />} />

      <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
        <Route path="/admin" element={<SuperAdminLayout />}>
          <Route index element={adminHome ? <Navigate to={adminHome} replace /> : null} />
          {adminRoutes}
          {fallbackRoute(adminHome)}
        </Route>
      </Route>

      <Route
        element={
          <ProtectedRoute
            allowedRoles={['TENANT_ADMIN', 'FORMULADOR', 'EVALUADOR', 'ANALISTA', 'VIEWER']}
          />
        }
      >
        <Route path="/tenant" element={<TenantLayout />}>
          <Route index element={tenantHome ? <Navigate to={tenantHome} replace /> : null} />
          {tenantRoutes}
          {import.meta.env.VITE_E2E === 'true' && (
            <Route path="e2e-crash" element={<E2ECrashPage />} />
          )}
          {fallbackRoute(tenantHome)}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AccessBootstrap>
        <BrowserRouter>
          <Suspense fallback={<RoutesFallback />}>
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </AccessBootstrap>
    </AuthProvider>
  );
}

export default App;
