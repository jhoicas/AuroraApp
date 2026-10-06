import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CatalogPagination from '../../components/admin/CatalogPagination';
import {
  adminProjectsApi,
  apiErrorMessage,
  pageMeta,
  usersApi,
  type AdminProject,
  type AdminUser,
} from '../../lib/accessAdminApi';
import { useTenantStore } from '../../store/tenantStore';

const PAGE_SIZE = 20;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-CO');

type Filters = { tenant_id: string; created_by: string; start_date: string; end_date: string };
const EMPTY: Filters = { tenant_id: '', created_by: '', start_date: '', end_date: '' };

/** Vista global de proyectos de todas las entidades (solo SUPER_ADMIN). */
export default function AdminProjectsPage() {
  const tenants = useTenantStore((s) => s.tenants);
  const fetchTenants = useTenantStore((s) => s.fetchTenants);

  const [form, setForm] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminProject[]>([]);
  const [total, setTotal] = useState(0);
  const [tenantUsers, setTenantUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchTenants();
  }, [fetchTenants]);

  // Sugerencias de creador: usuarios de la entidad elegida.
  useEffect(() => {
    if (!form.tenant_id) {
      setTenantUsers([]);
      return;
    }
    let cancelled = false;
    usersApi
      .list('platform', form.tenant_id)
      .then((u) => !cancelled && setTenantUsers(u))
      .catch(() => !cancelled && setTenantUsers([]));
    return () => {
      cancelled = true;
    };
  }, [form.tenant_id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminProjectsApi.list({ ...applied, page, limit: PAGE_SIZE });
      setRows(res.data);
      setTotal(res.total);
      if (res.data.length === 0 && res.total > 0 && page > 1) setPage(Math.ceil(res.total / PAGE_SIZE));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar los proyectos'));
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (k: keyof Filters, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    setApplied({ ...form, created_by: form.created_by.trim() });
    setPage(1);
  };

  const clear = () => {
    setForm(EMPTY);
    setApplied(EMPTY);
    setPage(1);
  };

  const field = 'w-full rounded border border-[#6f7979] px-3 py-2 bg-[#f9f9ff]';
  const label = 'block text-sm font-semibold mb-1';

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1440px] mx-auto">
        <header className="mb-8">
          <h2 className="font-headline text-3xl font-bold tracking-tight">Proyectos de todas las entidades</h2>
          <p className="text-lg text-[#3f4949] mt-1">Vista global de solo lectura para el administrador de la plataforma.</p>
        </header>

        <form onSubmit={apply} className="bg-white rounded-xl border border-[#bec9c8] p-4 mb-6 grid gap-4 md:grid-cols-5 items-end">
          <div>
            <label htmlFor="f-tenant" className={label}>Entidad</label>
            <select id="f-tenant" value={form.tenant_id} onChange={(e) => set('tenant_id', e.target.value)} className={field}>
              <option value="">Todas las entidades</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-creator" className={label}>Creador (email o ID)</label>
            <input
              id="f-creator"
              list="creator-options"
              value={form.created_by}
              onChange={(e) => set('created_by', e.target.value)}
              placeholder="usuario@entidad.gov.co"
              className={field}
            />
            <datalist id="creator-options">
              {tenantUsers.map((u) => (
                <option key={u.id} value={u.email}>{u.full_name}</option>
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="f-start" className={label}>Creado desde</label>
            <input id="f-start" type="date" value={form.start_date} max={form.end_date || undefined} onChange={(e) => set('start_date', e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="f-end" className={label}>Creado hasta</label>
            <input id="f-end" type="date" value={form.end_date} min={form.start_date || undefined} onChange={(e) => set('end_date', e.target.value)} className={field} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="inline-flex items-center gap-1 rounded bg-[#006162] hover:bg-[#2c7a7b] text-white px-4 py-2 text-sm font-medium">
              <span className="material-symbols-outlined text-base">filter_alt</span>
              Filtrar
            </button>
            <button type="button" onClick={clear} className="rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border border-gray-300">
              Limpiar
            </button>
          </div>
        </form>

        {error && (
          <div role="alert" className="mb-4 rounded border border-[#ffdad6] bg-[#ffdad6]/80 px-4 py-3 text-sm text-[#93000a]">{error}</div>
        )}

        <div className="overflow-x-auto rounded-xl border border-[#bec9c8] bg-white">
          <table className="w-full text-left">
            <thead className="bg-[#f0f3ff] text-sm">
              <tr>
                <th scope="col" className="px-4 py-3">Proyecto</th>
                <th scope="col" className="px-4 py-3">BPIN</th>
                <th scope="col" className="px-4 py-3">Entidad</th>
                <th scope="col" className="px-4 py-3">Creador</th>
                <th scope="col" className="px-4 py-3">Fase</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3">Creado</th>
                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7eeff]">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-[#3f4949]">Cargando proyectos…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-[#3f4949]">No se encontraron proyectos.</td></tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-semibold">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-sm">{p.code_bpin ?? '—'}</td>
                    <td className="px-4 py-3">{p.tenant_name}</td>
                    <td className="px-4 py-3">
                      {p.creator_name}
                      <div className="text-xs text-[#3f4949]">{p.creator_email}</div>
                    </td>
                    <td className="px-4 py-3">{p.fase_maduracion}</td>
                    <td className="px-4 py-3">{p.status}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        to={`/admin/projects/${p.id}`}
                        title="Ver formulación y detalle (solo lectura)"
                        aria-label={`Ver Formulación de ${p.name}`}
                        className="inline-flex items-center gap-1 rounded border border-[#006162] px-3 py-1.5 text-sm font-medium text-[#006162] hover:bg-[#006162] hover:text-white"
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden>visibility</span>
                        Ver Formulación
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <CatalogPagination meta={pageMeta({ total, page, limit: PAGE_SIZE })} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
