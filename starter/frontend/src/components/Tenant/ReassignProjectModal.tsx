import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { api } from '../../lib/api';
import { useProjectStore, type Project } from '../../store/projectStore';

type Candidate = { id: string; full_name: string; email: string };

type Props = {
  project: Project | null;
  onClose: () => void;
};

/** Permite a TENANT_ADMIN / SUPER_ADMIN transferir la autoría de un proyecto a otro formulador. */
export default function ReassignProjectModal({ project, onClose }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setSelected('');
    setError(null);
    setLoading(true);
    api
      .get<{ data: Candidate[] }>(`/projects/${project.id}/reassign-candidates`)
      .then(({ data }) => {
        if (!cancelled) setCandidates(data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la lista de formuladores');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project]);

  if (!project) return null;

  const options = candidates.filter((c) => c.id !== project.creator_id);

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/projects/${project.id}/reassign`, { created_by: selected });
      await useProjectStore.getState().fetchProjects();
      onClose();
    } catch (err) {
      const msg = isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined;
      setError(msg ?? 'No se pudo reasignar el proyecto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reassign-title"
    >
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
        <h2 id="reassign-title" className="text-lg font-semibold text-gray-900 mb-1">
          Reasignar formulador
        </h2>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{project.name}</p>

        <label htmlFor="reassign-select" className="block text-sm font-medium text-gray-700 mb-1">
          Nuevo formulador
        </label>
        <select
          id="reassign-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={loading || saving}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">{loading ? 'Cargando…' : 'Selecciona un formulador'}</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name} ({c.email})
            </option>
          ))}
        </select>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!selected || saving}
            className="px-4 py-2 rounded-lg bg-[#006162] text-white hover:bg-[#004f50] disabled:opacity-50"
          >
            {saving ? 'Reasignando…' : 'Reasignar'}
          </button>
        </div>
      </div>
    </div>
  );
}
