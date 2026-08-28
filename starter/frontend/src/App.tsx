import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login/Login';
import Register from './components/Register/Register';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import TenantLayout from './layouts/TenantLayout';
import TenantsPage from './pages/admin/TenantsPage';
import AIKnowledgePage from './pages/admin/AIKnowledgePage';
import CatalogImporter from './components/CatalogImporter';
import SectorsCatalogPage from './pages/admin/SectorsCatalogPage';
import ProgramsCatalogPage from './pages/admin/ProgramsCatalogPage';
import ProductsCatalogPage from './pages/admin/ProductsCatalogPage';
import EdtCatalogPage from './pages/admin/EdtCatalogPage';
import DeliverablesCatalogPage from './pages/admin/DeliverablesCatalogPage';
import ActivitiesCatalogPage from './pages/admin/ActivitiesCatalogPage';
import OdsCatalogPage from './pages/admin/OdsCatalogPage';
import ProjectsDashboard from './pages/tenant/ProjectsDashboard';
import ProjectDetailPage from './pages/tenant/ProjectDetailPage';
import CatalogPage from './pages/tenant/CatalogPage';
import AiAssistantPage from './pages/tenant/AiAssistantPage';

/** Solo disponible cuando Vite se arranca con VITE_E2E=true (suite Playwright). */
function E2ECrashPage(): never {
  throw new Error('Fallo E2E controlado para validar ErrorBoundary');
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
            <Route path="/admin" element={<SuperAdminLayout />}>
              <Route index element={<Navigate to="tenants" replace />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="users" element={<div className="p-4 text-gray-600">Usuarios (próximamente)</div>} />
              <Route path="catalogo" element={<Navigate to="/admin/catalogs/sectors" replace />} />
              <Route path="catalogs" element={<Navigate to="/admin/catalogs/sectors" replace />} />
              <Route path="catalogs/sectors" element={<SectorsCatalogPage />} />
              <Route path="catalogs/programs" element={<ProgramsCatalogPage />} />
              <Route path="catalogs/products" element={<ProductsCatalogPage />} />
              <Route path="catalogs/edt" element={<EdtCatalogPage />} />
              <Route path="catalogs/indicators" element={<Navigate to="/admin/catalogs/edt" replace />} />
              <Route path="catalogs/deliverables" element={<DeliverablesCatalogPage />} />
              <Route path="catalogs/activities" element={<ActivitiesCatalogPage />} />
              <Route path="catalogs/ods" element={<OdsCatalogPage />} />
              <Route
                path="catalogs/funding-sources"
                element={<Navigate to="/admin/catalogs/deliverables" replace />}
              />
              <Route path="ai" element={<AIKnowledgePage />} />
              <Route path="import-catalog" element={<CatalogImporter />} />
              <Route path="settings" element={<div className="p-4 text-gray-600">Configuración (próximamente)</div>} />
              <Route path="reports" element={<div className="p-4 text-gray-600">Reportes (próximamente)</div>} />
              <Route path="security" element={<div className="p-4 text-gray-600">Seguridad (próximamente)</div>} />
            </Route>
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  'TENANT_ADMIN',
                  'FORMULADOR',
                  'EVALUADOR',
                  'ANALISTA',
                  'VIEWER',
                ]}
              />
            }
          >
            <Route path="/tenant" element={<TenantLayout />}>
              <Route index element={<Navigate to="projects" replace />} />
              <Route path="projects" element={<ProjectsDashboard />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="formulation" element={<Navigate to="/tenant/projects" replace />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="ai" element={<AiAssistantPage />} />
              <Route path="reports" element={<div className="p-4 text-gray-600">Reportes (próximamente)</div>} />
              {import.meta.env.VITE_E2E === 'true' && (
                <Route path="e2e-crash" element={<E2ECrashPage />} />
              )}
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
