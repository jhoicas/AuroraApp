import { useEffect, useMemo, useState } from 'react';
import CreateTenantModal from '../../components/admin/CreateTenantModal';
import { useTenantStore, type Tenant, type TenantStatus } from '../../store/tenantStore';

/** Iniciales: primeras letras de las dos primeras palabras; si hay una sola, 2 primeros caracteres. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || '??';
}

function formatRegistro(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function TenantsPage() {
  const tenants = useTenantStore((s) => s.tenants);
  const isLoading = useTenantStore((s) => s.isLoading);
  const error = useTenantStore((s) => s.error);
  const fetchTenants = useTenantStore((s) => s.fetchTenants);
  const toggleTenantStatus = useTenantStore((s) => s.toggleTenantStatus);
  const clearError = useTenantStore((s) => s.clearError);

  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TenantStatus>('ALL');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchTenants();
  }, [fetchTenants]);

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      const matchSearch =
        !search.trim() ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.nit ?? '').includes(search) ||
        (t.domain ?? '').toLowerCase().includes(search.toLowerCase()) ||
        t.contact_email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [tenants, search, statusFilter]);

  const activeCount = tenants.filter((t) => t.status === 'ACTIVE').length;
  const suspendedCount = tenants.filter((t) => t.status === 'SUSPENDED').length;

  const handleToggle = async (tenant: Tenant) => {
    setTogglingId(tenant.id);
    try {
      await toggleTenantStatus(tenant.id, tenant.status);
    } catch {
      // error en store
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1440px] mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <h2 className="font-headline text-3xl md:text-4xl font-bold text-[#121c2c] tracking-tight">
              Gestión de Entidades
            </h2>
            <p className="text-lg md:text-xl text-[#3f4949] mt-2 leading-relaxed">
              Panel de administración central de organizaciones y límites de plataforma.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="h-14 px-10 bg-[#006162] hover:bg-[#2c7a7b] text-white rounded-lg font-semibold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#006162]"
          >
            <span className="material-symbols-outlined">add_business</span>
            + Registrar Entidad
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-[#ffdad6] bg-[#ffdad6]/80 px-4 py-3 text-sm text-[#93000a]"
          >
            <span>{error}</span>
            <button type="button" onClick={clearError} aria-label="Cerrar">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-xl border border-[#bec9c8] p-6 mb-10 flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-grow w-full space-y-2">
            <label htmlFor="tenant-search" className="font-semibold text-lg text-[#121c2c]">
              Buscar Entidad
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#6f7979]">
                search
              </span>
              <input
                id="tenant-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ej: Gobernación..."
                className="w-full h-14 pl-12 pr-4 bg-[#f9f9ff] border border-[#6f7979] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006162] focus:border-[#006162] text-lg"
              />
            </div>
          </div>
          <div className="w-full md:w-64 space-y-2">
            <label htmlFor="tenant-status" className="font-semibold text-lg text-[#121c2c]">
              Estado
            </label>
            <select
              id="tenant-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | TenantStatus)}
              className="w-full h-14 px-4 bg-[#f9f9ff] border border-[#6f7979] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006162] text-lg"
            >
              <option value="ALL">Todos los estados</option>
              <option value="ACTIVE">Activo</option>
              <option value="SUSPENDED">Suspendido</option>
            </select>
          </div>
        </div>

        {isLoading && tenants.length === 0 && (
          <p className="text-center text-[#3f4949] py-12 text-lg">Cargando entidades…</p>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="bg-white/95 rounded-xl border border-[#E2E8F0] p-10 text-center text-[#3f4949]">
            No hay entidades que coincidan con los filtros.
          </div>
        )}

        {/* Entities Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((tenant) => {
            const active = tenant.status === 'ACTIVE';
            return (
              <div
                key={tenant.id}
                className={`glass-card group rounded-xl p-6 flex flex-col bg-white/95 border transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[#319795] hover:shadow-[0px_10px_25px_rgba(44,122,123,0.1)] ${
                  active ? 'border-[#E2E8F0]' : 'border-[#ba1a1a]/20'
                }`}
              >
                <div className="flex items-start justify-between mb-6">
                  <div
                    className={`w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl font-headline ${
                      active
                        ? 'bg-[#a5eff0] text-[#006162]'
                        : 'bg-[#ffdad6] text-[#93000a]'
                    }`}
                  >
                    {initials(tenant.name)}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-base font-medium flex items-center gap-1 ${
                      active
                        ? 'bg-[#91f0ed] text-[#006e6d]'
                        : 'bg-[#ffdad6] text-[#93000a]'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${active ? 'bg-[#006a68]' : 'bg-[#ba1a1a]'}`}
                    />
                    {active ? 'Activo' : 'Suspendido'}
                  </span>
                </div>

                <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">
                  {tenant.name}
                </h3>
                <p className="text-lg text-[#3f4949] mb-8 leading-relaxed">
                  {tenant.domain
                    ? tenant.domain
                    : tenant.contact_email || 'Sin dominio / contacto'}
                </p>

                <div className="space-y-3 mb-8 border-t border-[#bec9c8] pt-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-[#3f4949] flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">badge</span> NIT
                    </span>
                    <span className="font-semibold text-lg">{tenant.nit || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg text-[#3f4949] flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">calendar_today</span>{' '}
                      Registro
                    </span>
                    <span className="font-semibold text-lg">
                      {formatRegistro(tenant.created_at)}
                    </span>
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={togglingId === tenant.id}
                    onClick={() => void handleToggle(tenant)}
                    className={`h-14 font-semibold text-lg rounded-lg transition-all active:scale-95 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] ${
                      active
                        ? 'border border-[#006162] text-[#006162] hover:bg-[#e7eeff]'
                        : 'border border-[#6f7979] text-[#6f7979] hover:bg-[#f0f3ff]'
                    }`}
                  >
                    {togglingId === tenant.id ? '…' : active ? 'Suspender' : 'Administrar'}
                  </button>
                  <button
                    type="button"
                    disabled={togglingId === tenant.id}
                    onClick={() => {
                      if (!active) void handleToggle(tenant);
                      else setModalOpen(true);
                    }}
                    className={`h-14 font-semibold text-lg rounded-lg transition-all active:scale-95 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#006162] ${
                      active
                        ? 'bg-[#006162] text-white hover:bg-[#2c7a7b]'
                        : 'bg-[#6f7979] text-white hover:bg-[#3f4949]'
                    }`}
                  >
                    {active ? 'Configurar' : 'Reactivar'}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Dashboard Insights Widget */}
          <div className="lg:col-span-3 glass-card rounded-xl p-10 grid grid-cols-1 md:grid-cols-4 gap-10 items-center relative overflow-hidden bg-white/95 border border-[#E2E8F0] transition-all duration-300 hover:-translate-y-1 hover:border-[#319795] hover:shadow-[0px_10px_25px_rgba(44,122,123,0.1)]">
            <div className="md:col-span-1 md:border-r border-[#bec9c8] md:pr-6">
              <h4 className="font-semibold text-lg text-[#3f4949] uppercase tracking-wider mb-2">
                Total Entidades
              </h4>
              <p className="text-5xl font-bold text-[#006162] leading-none">{tenants.length}</p>
              <p className="text-lg text-[#3f4949] mt-2">
                {filtered.length !== tenants.length
                  ? `${filtered.length} visibles con filtro`
                  : 'En la plataforma'}
              </p>
            </div>
            <div className="md:col-span-1 md:border-r border-[#bec9c8] md:px-6">
              <h4 className="font-semibold text-lg text-[#3f4949] uppercase tracking-wider mb-2">
                Activas
              </h4>
              <p className="text-5xl font-bold text-[#006a68] leading-none">{activeCount}</p>
              <p className="text-lg text-[#3f4949] mt-2">
                {tenants.length
                  ? `${Math.round((activeCount / tenants.length) * 100)}% del total`
                  : 'Sin datos'}
              </p>
            </div>
            <div className="md:col-span-1 md:border-r border-[#bec9c8] md:px-6">
              <h4 className="font-semibold text-lg text-[#3f4949] uppercase tracking-wider mb-2">
                Suspendidas
              </h4>
              <p className="text-5xl font-bold text-[#455b58] leading-none">{suspendedCount}</p>
              <p className="text-lg text-[#3f4949] mt-2">Requieren revisión</p>
            </div>
            <div className="md:col-span-1 md:pl-6">
              <div className="p-4 bg-[#89d3d4] rounded-lg">
                <p className="font-semibold text-lg text-[#002020] mb-1">Estado del Sistema</p>
                <p className="text-base text-[#004f50]">
                  Catálogo y tenants operan sobre la base remota configurada en DATABASE_URL.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAB Support */}
      <button
        type="button"
        className="fixed bottom-10 right-10 w-16 h-16 bg-[#006162] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#006162]"
        aria-label="Soporte"
        onClick={() => window.alert('Canal de soporte Super Admin (próximamente).')}
      >
        <span className="material-symbols-outlined text-4xl">support_agent</span>
      </button>

      <CreateTenantModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
