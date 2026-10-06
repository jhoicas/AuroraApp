import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiErrorMessage, modulesApi, pageMeta, type AdminModule } from '../../lib/accessAdminApi';
import CatalogPagination from '../../components/admin/CatalogPagination';
import { useAccessStore } from '../../store/accessStore';
import Modal, { ghostBtn, inputClass, primaryBtn } from '../../components/admin/Modal';

type Row = { module: AdminModule; depth: number };

/** Módulos raíz con sus secciones debajo, ordenados por sort_order. */
export function flattenModules(mods: AdminModule[]): Row[] {
  const byOrder = (a: AdminModule, b: AdminModule) => a.sort_order - b.sort_order || a.code.localeCompare(b.code);
  const roots = mods.filter((m) => !m.parent_id).sort(byOrder);
  const out: Row[] = [];
  for (const r of roots) {
    out.push({ module: r, depth: 0 });
    mods.filter((m) => m.parent_id === r.id).sort(byOrder).forEach((c) => out.push({ module: c, depth: 1 }));
  }
  return out;
}

/** Reordena `id` una posición entre sus hermanos; devuelve solo los sort_order que cambian. */
export function moveWithinSiblings(mods: AdminModule[], id: string, dir: -1 | 1): { id: string; sort_order: number }[] {
  const target = mods.find((m) => m.id === id);
  if (!target) return [];
  const sibs = mods
    .filter((m) => (m.parent_id ?? null) === (target.parent_id ?? null))
    .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
  const i = sibs.findIndex((m) => m.id === id);
  const j = i + dir;
  if (j < 0 || j >= sibs.length) return [];
  const next = [...sibs];
  [next[i], next[j]] = [next[j], next[i]];
  const slots = sibs.map((m) => m.sort_order);
  const distinct = new Set(slots).size === slots.length;
  const base = slots[0];
  return next
    .map((m, k) => ({ id: m.id, sort_order: distinct ? slots[k] : base + k }))
    .filter((it) => sibs.find((m) => m.id === it.id)!.sort_order !== it.sort_order);
}

type FormState = { mode: 'create' } | { mode: 'edit'; module: AdminModule } | null;

function ModuleForm({
  state,
  mods,
  onClose,
  onDone,
}: {
  state: NonNullable<FormState>;
  mods: AdminModule[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const editing = state.mode === 'edit' ? state.module : null;
  const [code, setCode] = useState(editing?.code ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [route, setRoute] = useState(editing?.route ?? '');
  const [sortOrder, setSortOrder] = useState(String(editing?.sort_order ?? 0));
  const [kind, setKind] = useState('MODULE');
  const [scope, setScope] = useState('TENANT');
  const [parentCode, setParentCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parents = mods.filter((m) => m.kind === 'MODULE');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editing) {
        await modulesApi.update(editing.id, { name, description, route, sort_order: Number(sortOrder) });
      } else {
        await modulesApi.create({
          code,
          name,
          description,
          kind,
          scope: kind === 'SECTION' ? (parents.find((p) => p.code === parentCode)?.scope ?? scope) : scope,
          parent_code: kind === 'SECTION' ? parentCode : undefined,
          route,
          sort_order: Number(sortOrder),
        });
      }
      await onDone();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el módulo'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? 'Editar módulo' : 'Nuevo módulo'} titleId="module-form-title" onClose={onClose}>
      <form onSubmit={submit} className="px-6 py-5 space-y-4">
        {!editing && (
          <>
            <div>
              <label htmlFor="mod-code" className="block text-sm font-medium text-gray-700 mb-1">Código</label>
              <input id="mod-code" required value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} placeholder="reports.custom" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="mod-kind" className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select id="mod-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
                  <option value="MODULE">Módulo</option>
                  <option value="SECTION">Sección</option>
                </select>
              </div>
              {kind === 'SECTION' ? (
                <div>
                  <label htmlFor="mod-parent" className="block text-sm font-medium text-gray-700 mb-1">Módulo padre</label>
                  <select id="mod-parent" required value={parentCode} onChange={(e) => setParentCode(e.target.value)} className={inputClass}>
                    <option value="">Selecciona…</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="mod-scope" className="block text-sm font-medium text-gray-700 mb-1">Alcance</label>
                  <select id="mod-scope" value={scope} onChange={(e) => setScope(e.target.value)} className={inputClass}>
                    <option value="TENANT">Entidad</option>
                    <option value="PLATFORM">Plataforma</option>
                  </select>
                </div>
              )}
            </div>
          </>
        )}
        <div>
          <label htmlFor="mod-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input id="mod-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="mod-desc" className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <input id="mod-desc" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label htmlFor="mod-route" className="block text-sm font-medium text-gray-700 mb-1">Ruta</label>
            <input id="mod-route" required value={route} onChange={(e) => setRoute(e.target.value)} className={inputClass} placeholder="/tenant/mi-modulo" />
          </div>
          <div>
            <label htmlFor="mod-order" className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
            <input id="mod-order" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputClass} />
          </div>
        </div>
        {error && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancelar</button>
          <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}

const PAGE_SIZE = 15;

export default function ModulesPage() {
  /** Lista completa: orden entre hermanos y selector de padres. La tabla usa `pageRows`. */
  const [mods, setMods] = useState<AdminModule[]>([]);
  const [pageRows, setPageRows] = useState<AdminModule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const fetchAccess = useAccessStore((s) => s.fetchAccess);

  // Búsqueda en tiempo real con debounce; cada búsqueda nueva vuelve a la página 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const [all, paged] = await Promise.all([modulesApi.list(), modulesApi.listPage({ page, limit: PAGE_SIZE, search: query })]);
      setMods(all);
      setPageRows(paged.data);
      setTotal(paged.total);
      // La página quedó fuera de rango (p. ej. tras borrar el último ítem): retrocede.
      if (paged.data.length === 0 && paged.total > 0 && page > 1) setPage(Math.ceil(paged.total / PAGE_SIZE));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar los módulos'));
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => pageRows.map((m) => ({ module: m, depth: m.parent_id ? 1 : 0 })), [pageRows]);

  /** Refresca la lista y el menú propio (los cambios afectan la navegación). */
  const refresh = async () => {
    await load();
    void fetchAccess();
  };

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
    }
  };

  const remove = (m: AdminModule) => {
    if (!window.confirm(`¿Eliminar el módulo "${m.name}"?`)) return;
    void run(() => modulesApi.remove(m.id), 'No se pudo eliminar el módulo');
  };

  const iconBtn = 'p-2 rounded hover:bg-[#f0f3ff] text-[#3f4949] disabled:opacity-40';

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1440px] mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="font-headline text-3xl font-bold tracking-tight">Gestión de módulos</h2>
            <p className="text-lg text-[#3f4949] mt-1">Crea, ordena y activa los módulos de la plataforma.</p>
          </div>
          <button type="button" onClick={() => setForm({ mode: 'create' })} className={primaryBtn}>
            <span className="material-symbols-outlined text-base">add</span>
            Nuevo módulo
          </button>
        </header>

        {error && (
          <div role="alert" className="mb-4 rounded border border-[#ffdad6] bg-[#ffdad6]/80 px-4 py-3 text-sm text-[#93000a]">{error}</div>
        )}

        <div className="mb-4">
          <label htmlFor="module-search" className="block text-sm font-semibold mb-1">Buscar</label>
          <input
            id="module-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nombre, código o sección"
            className="w-full md:w-96 rounded border border-[#6f7979] px-3 py-2 bg-[#f9f9ff]"
          />
        </div>

        {loading ? (
          <p className="text-[#3f4949]">Cargando módulos…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#bec9c8] bg-white">
            <table className="w-full text-left">
              <thead className="bg-[#f0f3ff] text-sm">
                <tr>
                  <th scope="col" className="px-4 py-3">Módulo</th>
                  <th scope="col" className="px-4 py-3">Código</th>
                  <th scope="col" className="px-4 py-3">Alcance</th>
                  <th scope="col" className="px-4 py-3">Ruta</th>
                  <th scope="col" className="px-4 py-3">Orden</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7eeff]">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-[#3f4949]">No se encontraron módulos.</td>
                  </tr>
                )}
                {rows.map(({ module: m, depth }) => (
                  <tr key={m.id} className={m.is_active ? '' : 'opacity-60'}>
                    <td className={`px-4 py-3 ${depth ? 'pl-10' : 'font-semibold'}`}>
                      {m.name}
                      {m.is_system && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">sistema</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{m.code}</td>
                    <td className="px-4 py-3">{m.scope === 'PLATFORM' ? 'Plataforma' : 'Entidad'}</td>
                    <td className="px-4 py-3 font-mono text-sm">{m.route}</td>
                    <td className="px-4 py-3">{m.sort_order}</td>
                    <td className="px-4 py-3">{m.is_active ? 'Activo' : 'Inactivo'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button type="button" className={iconBtn} aria-label={`Subir ${m.name}`} title="Subir" onClick={() => void run(() => modulesApi.reorder(moveWithinSiblings(mods, m.id, -1)), 'No se pudo reordenar')}>
                        <span className="material-symbols-outlined">arrow_upward</span>
                      </button>
                      <button type="button" className={iconBtn} aria-label={`Bajar ${m.name}`} title="Bajar" onClick={() => void run(() => modulesApi.reorder(moveWithinSiblings(mods, m.id, 1)), 'No se pudo reordenar')}>
                        <span className="material-symbols-outlined">arrow_downward</span>
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        aria-label={`${m.is_active ? 'Desactivar' : 'Activar'} ${m.name}`}
                        title={m.is_active ? 'Desactivar' : 'Activar'}
                        onClick={() => void run(() => modulesApi.update(m.id, { is_active: !m.is_active }), 'No se pudo cambiar el estado')}
                      >
                        <span className="material-symbols-outlined">{m.is_active ? 'toggle_on' : 'toggle_off'}</span>
                      </button>
                      <button type="button" className={iconBtn} aria-label={`Editar ${m.name}`} title="Editar" onClick={() => setForm({ mode: 'edit', module: m })}>
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      {!m.is_system && (
                        <button type="button" className={iconBtn} aria-label={`Eliminar ${m.name}`} title="Eliminar" onClick={() => remove(m)}>
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <CatalogPagination meta={pageMeta({ total, page, limit: PAGE_SIZE })} onPageChange={setPage} />
          </div>
        )}
      </div>
      {form && <ModuleForm state={form} mods={mods} onClose={() => setForm(null)} onDone={refresh} />}
    </div>
  );
}
