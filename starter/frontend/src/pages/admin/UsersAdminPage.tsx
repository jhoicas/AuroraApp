import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSuperAdmin } from '../../lib/roles';
import { useAccessStore } from '../../store/accessStore';
import { useTenantStore } from '../../store/tenantStore';
import { ROLE_LABELS, apiErrorMessage, usersApi, type AdminScope, type AdminUser } from '../../lib/accessAdminApi';
import PasswordModal from '../../components/admin/PasswordModal';
import UserFormModal, { type UserFormValues } from '../../components/admin/UserFormModal';
import UserPermissionsModal from '../../components/admin/UserPermissionsModal';
import { primaryBtn } from '../../components/admin/Modal';

type ModalState =
  | { kind: 'create' }
  | { kind: 'edit'; user: AdminUser }
  | { kind: 'password'; user: AdminUser }
  | { kind: 'permissions'; user: AdminUser }
  | null;

/**
 * Administración de usuarios y permisos. Reutilizable: SUPER_ADMIN (/admin/users, con selector
 * de entidad) y TENANT_ADMIN (/tenant/users, siempre su propia entidad).
 */
export default function UsersAdminPage() {
  const { user: me } = useAuth();
  const platform = isSuperAdmin(me?.role);
  const scope: AdminScope = platform ? 'platform' : 'tenant';
  const moduleCode = platform ? 'admin.users' : 'users';
  const can = useAccessStore((s) => s.can);
  const canCreate = platform || can(moduleCode, 'create');
  const canEdit = platform || can(moduleCode, 'edit');

  const tenants = useTenantStore((s) => s.tenants);
  const fetchTenants = useTenantStore((s) => s.fetchTenants);
  const [tenantId, setTenantId] = useState('');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (platform) void fetchTenants();
  }, [platform, fetchTenants]);

  const needsTenant = platform && !tenantId;

  const load = useCallback(async () => {
    if (needsTenant) {
      setUsers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setUsers(await usersApi.list(scope, tenantId || undefined));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar los usuarios'));
    } finally {
      setLoading(false);
    }
  }, [needsTenant, scope, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const submitForm = async (values: UserFormValues) => {
    if (modal?.kind === 'edit') {
      await usersApi.update(scope, modal.user.id, {
        full_name: values.full_name,
        email: values.email,
        role_code: values.role_code,
      });
    } else {
      await usersApi.create(scope, tenantId || undefined, {
        email: values.email,
        full_name: values.full_name,
        password: values.password,
        role_code: values.role_code,
      });
    }
    await load();
  };

  const toggleStatus = async (u: AdminUser) => {
    setError(null);
    try {
      await usersApi.setStatus(scope, u.id, !u.is_active);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo cambiar el estado'));
    }
  };

  const iconBtn = 'p-2 rounded hover:bg-[#f0f3ff] text-[#3f4949] disabled:opacity-40';

  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1440px] mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="font-headline text-3xl font-bold tracking-tight">Usuarios y permisos</h2>
            <p className="text-lg text-[#3f4949] mt-1">
              {platform ? 'Administra los usuarios de cualquier entidad.' : 'Administra los usuarios de tu entidad.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {platform && (
              <Link to="/admin/roles" className="inline-flex items-center gap-1 rounded border border-[#006162] px-4 py-2 text-sm font-medium text-[#006162] hover:bg-[#f0f3ff]">
                <span className="material-symbols-outlined text-base">rule_settings</span>
                Plantillas de rol
              </Link>
            )}
            {canCreate && (
              <button type="button" onClick={() => setModal({ kind: 'create' })} disabled={needsTenant} className={primaryBtn}>
                <span className="material-symbols-outlined text-base">person_add</span>
                Nuevo usuario
              </button>
            )}
          </div>
        </header>

        <div className="bg-white rounded-xl border border-[#bec9c8] p-4 mb-6 flex flex-col md:flex-row gap-4">
          {platform && (
            <div className="md:w-80">
              <label htmlFor="tenant-select" className="block text-sm font-semibold mb-1">
                Entidad
              </label>
              <select
                id="tenant-select"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full rounded border border-[#6f7979] px-3 py-2 bg-[#f9f9ff]"
              >
                <option value="">Selecciona una entidad…</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1">
            <label htmlFor="user-search" className="block text-sm font-semibold mb-1">
              Buscar
            </label>
            <input
              id="user-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre o email"
              className="w-full rounded border border-[#6f7979] px-3 py-2 bg-[#f9f9ff]"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded border border-[#ffdad6] bg-[#ffdad6]/80 px-4 py-3 text-sm text-[#93000a]">
            {error}
          </div>
        )}

        {needsTenant ? (
          <p className="text-[#3f4949]">Selecciona una entidad para ver sus usuarios.</p>
        ) : loading ? (
          <p className="text-[#3f4949]">Cargando usuarios…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#bec9c8] bg-white">
            <table className="w-full text-left">
              <thead className="bg-[#f0f3ff] text-sm">
                <tr>
                  <th scope="col" className="px-4 py-3">Nombre</th>
                  <th scope="col" className="px-4 py-3">Email</th>
                  <th scope="col" className="px-4 py-3">Rol</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7eeff]">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[#3f4949]">
                      No hay usuarios.
                    </td>
                  </tr>
                )}
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-semibold">{u.full_name}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{ROLE_LABELS[u.role] ?? u.role}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.is_active ? 'bg-teal-50 text-teal-800' : 'bg-gray-100 text-gray-600'}`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button type="button" className={iconBtn} title="Permisos" aria-label={`Permisos de ${u.full_name}`} onClick={() => setModal({ kind: 'permissions', user: u })}>
                        <span className="material-symbols-outlined">grid_on</span>
                      </button>
                      {canEdit && (
                        <>
                          <button type="button" className={iconBtn} title="Editar" aria-label={`Editar ${u.full_name}`} onClick={() => setModal({ kind: 'edit', user: u })}>
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button type="button" className={iconBtn} title="Cambiar contraseña" aria-label={`Cambiar contraseña de ${u.full_name}`} onClick={() => setModal({ kind: 'password', user: u })}>
                            <span className="material-symbols-outlined">key</span>
                          </button>
                          <button
                            type="button"
                            className={iconBtn}
                            title={u.is_active ? 'Desactivar' : 'Activar'}
                            aria-label={`${u.is_active ? 'Desactivar' : 'Activar'} a ${u.full_name}`}
                            onClick={() => void toggleStatus(u)}
                          >
                            <span className="material-symbols-outlined">{u.is_active ? 'toggle_on' : 'toggle_off'}</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(modal?.kind === 'create' || modal?.kind === 'edit') && (
        <UserFormModal user={modal.kind === 'edit' ? modal.user : undefined} onClose={() => setModal(null)} onSubmit={submitForm} />
      )}
      {modal?.kind === 'password' && (
        <PasswordModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSubmit={(pw) => usersApi.setPassword(scope, modal.user.id, pw)}
        />
      )}
      {modal?.kind === 'permissions' && (
        <UserPermissionsModal scope={scope} user={modal.user} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
