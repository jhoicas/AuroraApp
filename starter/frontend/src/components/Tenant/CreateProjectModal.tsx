import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AIAssistedField from '../AuroraAsistente/AIAssistedField';
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
          <AIAssistedField
            label="Nombre"
            htmlFor="project-name"
            required
            guidance="Use un nombre corto y descriptivo del bien o servicio público (qué se entrega y dónde). Evite jerga interna; debe ser comprensible para veeduría ciudadana y trazabilidad BPIN."
            askPrompt="¿Cómo debería nombrar un proyecto de inversión pública según el manual de procedimientos del DNP? Dame 3 ejemplos de buenos nombres."
          >
            <input
              id="project-name"
              required
              minLength={3}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Mejoramiento de vías rurales"
            />
          </AIAssistedField>

          <AIAssistedField
            label="Sector"
            htmlFor="project-sector"
            required
            guidance="El sector define la clasificación programática DNP. Debe coincidir con el catálogo oficial (salud, educación, agua, etc.) para encadenar programa y producto."
            askPrompt="¿Cómo elijo el sector correcto del catálogo DNP para mi proyecto de inversión? Explica el criterio de clasificación programática."
          >
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
          </AIAssistedField>

          <AIAssistedField
            label="Código BPIN"
            htmlFor="project-bpin"
            guidance="El BPIN identifica el proyecto en el Banco de Programas y Proyectos. Si aún no lo tiene, déjelo vacío y regístrelo cuando la entidad lo asigne."
            askPrompt="¿Qué es el código BPIN y cuándo debo registrarlo en la formulación de un proyecto MGA?"
          >
            <input
              id="project-bpin"
              value={codeBpin}
              onChange={(e) => setCodeBpin(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="2024000123456 (opcional)"
            />
          </AIAssistedField>

          <AIAssistedField
            label="Descripción"
            htmlFor="project-desc"
            guidance="Resuma en pocas líneas el alcance del proyecto: qué se construye o implementa, para quién y en qué territorio. No sustituye el problema central ni el objetivo general."
            askPrompt="¿Cómo redacto una descripción breve y clara de un proyecto de inversión pública para el MGA?"
          >
            <textarea
              id="project-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
              placeholder="Breve descripción del proyecto de inversión"
            />
          </AIAssistedField>

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
