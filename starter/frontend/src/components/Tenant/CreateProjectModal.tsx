import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useProjectStore } from '../../store/projectStore';

type SectorOption = { id?: string; code?: string; name: string };

const FALLBACK_SECTORS: SectorOption[] = [
  { name: 'Educación' },
  { name: 'Salud' },
  { name: 'Agua potable y saneamiento básico' },
  { name: 'Transporte' },
  { name: 'Vivienda' },
  { name: 'Ambiente y desarrollo sostenible' },
  { name: 'Agricultura y desarrollo rural' },
  { name: 'Cultura, deporte y recreación' },
];

type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const createProject = useProjectStore((s) => s.createProject);
  const isLoading = useProjectStore((s) => s.isLoading);

  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [codeBpin, setCodeBpin] = useState('');
  const [description, setDescription] = useState('');
  const [sectors, setSectors] = useState<SectorOption[]>(FALLBACK_SECTORS);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ data?: SectorOption[] } | SectorOption[]>(
          '/catalog/sectors',
          { params: { page: 1, limit: 20 } },
        );
        if (cancelled) return;
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        if (list.length > 0) {
          setSectors(list);
        }
      } catch {
        // se mantienen los sectores de respaldo
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const reset = () => {
    setName('');
    setSector('');
    setCodeBpin('');
    setDescription('');
    setFormError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      const project = await createProject({
        name,
        sector,
        description: description || undefined,
        code_bpin: codeBpin || undefined,
      });
      handleClose();
      navigate(`/tenant/projects/${project.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear el proyecto');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        className="w-full max-w-lg rounded-lg bg-white shadow-lg border border-gray-100"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 id="create-project-title" className="text-lg font-semibold text-gray-800">
            Nuevo proyecto MGA
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="project-name"
              required
              minLength={3}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Mejoramiento de vías rurales"
            />
          </div>

          <div>
            <label htmlFor="project-sector" className="block text-sm font-medium text-gray-700 mb-1">
              Sector <span className="text-red-500">*</span>
            </label>
            <select
              id="project-sector"
              required
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">Selecciona un sector</option>
              {sectors.map((s) => (
                <option key={s.id ?? s.name} value={s.name}>
                  {s.code ? `${s.code} — ${s.name}` : s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="project-bpin" className="block text-sm font-medium text-gray-700 mb-1">
              Código BPIN <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              id="project-bpin"
              value={codeBpin}
              onChange={(e) => setCodeBpin(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="2024000123456"
            />
          </div>

          <div>
            <label htmlFor="project-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              id="project-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
              placeholder="Breve descripción del proyecto de inversión"
            />
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium"
            >
              <span className="material-symbols-outlined text-base">add</span>
              {isLoading ? 'Creando…' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
