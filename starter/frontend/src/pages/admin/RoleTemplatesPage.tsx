import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ACTION_LABELS,
  MATRIX_ACTIONS,
  type MatrixAction,
} from '../../lib/permissionMatrix';
import {
  ROLE_LABELS,
  TEMPLATE_ROLES,
  apiErrorMessage,
  modulesApi,
  roleTemplatesApi,
  type AdminModule,
  type RoleTemplate,
} from '../../lib/accessAdminApi';
import { primaryBtn } from '../../components/admin/Modal';

type Flags = { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean };
type Draft = Record<string, Flags>;

const KEY: Record<MatrixAction, keyof Flags> = {
  view: 'can_view',
  create: 'can_create',
  edit: 'can_edit',
  delete: 'can_delete',
};
const NONE: Flags = { can_view: false, can_create: false, can_edit: false, can_delete: false };

/** Escribir exige ver: quitar `view` limpia el resto; marcar create/edit/delete marca `view`. */
export function toggleFlag(flags: Flags, action: MatrixAction, value: boolean): Flags {
  const next = { ...flags, [KEY[action]]: value };
  if (action === 'view' && !value) return { ...NONE };
  if (action !== 'view' && value) next.can_view = true;
  return next;
}

/** Solo los módulos con algún permiso: el resto queda sin default. */
export function draftToModules(draft: Draft): RoleTemplate['modules'] {
  return Object.fromEntries(
    Object.entries(draft).filter(([, f]) => f.can_view || f.can_create || f.can_edit || f.can_delete),
  );
}

/** Editor de las plantillas de permisos por defecto de cada rol (solo SUPER_ADMIN). */
export default function RoleTemplatesPage() {
  const [mods, setMods] = useState<AdminModule[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [role, setRole] = useState<string>(TEMPLATE_ROLES[0]);
  const [draft, setDraft] = useState<Draft>({});
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Módulos asignables a entidades (los de plataforma no llevan plantilla), raíz con sus secciones.
  const rows = useMemo(() => {
    const tenantMods = mods.filter((m) => m.scope === 'TENANT' && m.is_active);
    const by = (a: AdminModule, b: AdminModule) => a.sort_order - b.sort_order || a.code.localeCompare(b.code);
    const roots = tenantMods.filter((m) => !m.parent_id).sort(by);
    return roots.flatMap((r) => [
      { module: r, depth: 0 },
      ...tenantMods.filter((m) => m.parent_id === r.id).sort(by).map((c) => ({ module: c, depth: 1 })),
    ]);
  }, [mods]);

  const load = useCallback(async () => {
    try {
      const [m, t] = await Promise.all([modulesApi.list(), roleTemplatesApi.list()]);
      setMods(m);
      setTemplates(t);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar las plantillas'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Al cambiar de rol o recibir datos nuevos, el borrador parte de lo guardado.
  useEffect(() => {
    const tpl = templates.find((t) => t.role === role);
    setDraft({ ...(tpl?.modules ?? {}) });
    setDirty(false);
    setSaved(false);
  }, [role, templates]);

  const flagsOf = (code: string): Flags => draft[code] ?? NONE;

  const change = (code: string, action: MatrixAction, value: boolean) => {
    setDraft((d) => ({ ...d, [code]: toggleFlag(d[code] ?? NONE, action, value) }));
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await roleTemplatesApi.save(role, draftToModules(draft));
      setTemplates((ts) => ts.map((t) => (t.role === updated.role ? updated : t)));
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar la plantilla'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1440px] mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="font-headline text-3xl font-bold tracking-tight">Plantillas de rol</h2>
            <p className="text-lg text-[#3f4949] mt-1">
              Permisos por defecto de cada rol. Se aplican a los usuarios nuevos y con «Aplicar plantilla de rol»; no
              cambian los permisos ya otorgados.
            </p>
          </div>
          <button type="button" onClick={() => void save()} disabled={!dirty || saving} className={primaryBtn}>
            <span className="material-symbols-outlined text-base">save</span>
            {saving ? 'Guardando…' : 'Guardar plantilla'}
          </button>
        </header>

        <div className="bg-white rounded-xl border border-[#bec9c8] p-4 mb-6">
          <label htmlFor="role-select" className="block text-sm font-semibold mb-1">Rol</label>
          <select
            id="role-select"
            value={role}
            onChange={(e) => {
              if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
              setRole(e.target.value);
            }}
            className="w-full md:w-80 rounded border border-[#6f7979] px-3 py-2 bg-[#f9f9ff]"
          >
            {TEMPLATE_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <p className="text-xs text-[#3f4949] mt-2">
            {ROLE_LABELS.TENANT_ADMIN} no tiene plantilla: siempre tiene acceso completo a los módulos de su entidad.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded border border-[#ffdad6] bg-[#ffdad6]/80 px-4 py-3 text-sm text-[#93000a]">{error}</div>
        )}
        {saved && (
          <div role="status" className="mb-4 rounded border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            Plantilla de {ROLE_LABELS[role]} guardada.
          </div>
        )}

        {loading ? (
          <p className="text-[#3f4949]">Cargando plantillas…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#bec9c8] bg-white">
            <table className="w-full text-left">
              <thead className="bg-[#f0f3ff] text-sm">
                <tr>
                  <th scope="col" className="px-4 py-3">Módulo</th>
                  {MATRIX_ACTIONS.map((a) => (
                    <th key={a} scope="col" className="w-24 px-4 py-3 text-center">{ACTION_LABELS[a]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7eeff]">
                {rows.map(({ module: m, depth }) => (
                  <tr key={m.code}>
                    <th scope="row" className={`px-4 py-2 text-sm text-left ${depth ? 'pl-10 font-normal text-gray-600' : 'font-semibold'}`}>
                      {m.name}
                    </th>
                    {MATRIX_ACTIONS.map((a) => (
                      <td key={a} className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${m.name} · ${ACTION_LABELS[a]}`}
                          checked={flagsOf(m.code)[KEY[a]]}
                          onChange={(e) => change(m.code, a, e.target.checked)}
                          className="h-4 w-4 accent-[#006162]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
