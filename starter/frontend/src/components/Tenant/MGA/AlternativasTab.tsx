import { useState } from 'react';
import { HelpCircle, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import type { MgaAlternative } from '../../../lib/mgaApi';
import MgaAlert from './MgaAlert';

type AlternativasTabProps = {
  project: Project;
};

const EMPTY_DRAFT = {
  description: '',
  evaluate_profitability: false,
  evaluate_cost: false,
  proceeds_to_preparation: false,
};

export default function AlternativasTab({ project }: AlternativasTabProps) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const addAlternative = useProjectMgaStore((s) => s.addAlternative);
  const editAlternative = useProjectMgaStore((s) => s.editAlternative);
  const removeAlternative = useProjectMgaStore((s) => s.removeAlternative);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const { alternatives } = getFormulation(project.id);

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!draft.description.trim()) {
      setError('La descripción de la alternativa es obligatoria.');
      return;
    }
    setError(null);
    const payload = {
      description: draft.description.trim(),
      evaluate_profitability: draft.evaluate_profitability,
      evaluate_cost: draft.evaluate_cost,
      proceeds_to_preparation: draft.proceeds_to_preparation,
    };
    try {
      if (editingId) {
        await editAlternative(project.id, editingId, payload);
        setMessage('Alternativa actualizada.');
      } else {
        await addAlternative(project.id, payload);
        setMessage('Alternativa creada.');
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la alternativa');
    }
  };

  const startEdit = (alt: MgaAlternative) => {
    setEditingId(alt.id);
    setDraft({
      description: alt.description,
      evaluate_profitability: alt.evaluate_profitability,
      evaluate_cost: alt.evaluate_cost,
      proceeds_to_preparation: alt.proceeds_to_preparation,
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta alternativa?')) return;
    setError(null);
    try {
      await removeAlternative(project.id, id);
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la alternativa');
    }
  };

  const toggleFlag = (key: keyof typeof EMPTY_DRAFT) => {
    if (key === 'description') return;
    setDraft((d) => ({ ...d, [key]: !d[key] }));
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Alternativas de solución</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      <div className="border rounded p-4 bg-gray-50 space-y-3">
        <AIAssistedField
          label="Nombre / descripción de la alternativa"
          htmlFor={`alt-desc-${project.id}`}
          required
          guidance="Describa cada alternativa de manera diferenciada: qué acción se propone, cómo atiende las causas y por qué es viable según MGA."
          askPrompt={`¿Qué alternativas de solución debo plantear para el proyecto "${project.name}" y cómo las redacto según MGA?`}
        >
          <textarea
            id={`alt-desc-${project.id}`}
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            className="w-full p-2 border rounded bg-white"
            placeholder="Describa la alternativa…"
          />
        </AIAssistedField>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.evaluate_profitability}
              onChange={() => toggleFlag('evaluate_profitability')}
              className="rounded border-gray-300"
            />
            <span>Evaluar rentabilidad</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.evaluate_cost}
              onChange={() => toggleFlag('evaluate_cost')}
              className="rounded border-gray-300"
            />
            <span>Evaluar costo</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.proceeds_to_preparation}
              onChange={() => toggleFlag('proceeds_to_preparation')}
              className="rounded border-gray-300"
            />
            <span>Pasa a preparación</span>
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white font-semibold rounded disabled:opacity-60"
          >
            <PlusCircle className="w-4 h-4" />
            {editingId ? 'Actualizar alternativa' : 'Adicionar alternativa'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-left">
          <thead className="bg-[#6c757d] text-white">
            <tr>
              <th className="p-2 border">Acciones</th>
              <th className="p-2 border">Alternativa</th>
              <th className="p-2 border text-center">Rentabilidad</th>
              <th className="p-2 border text-center">Costo</th>
              <th className="p-2 border text-center">Preparación</th>
            </tr>
          </thead>
          <tbody>
            {alternatives.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  No hay alternativas registradas.
                </td>
              </tr>
            ) : (
              alternatives.map((alt) => (
                <tr key={alt.id} className="border-b hover:bg-gray-50 align-top">
                  <td className="p-2 border text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => startEdit(alt)}
                      disabled={isSaving}
                      className="p-1 bg-[#2980b9] text-white rounded mr-1 disabled:opacity-60"
                      aria-label="Editar alternativa"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(alt.id)}
                      disabled={isSaving}
                      className="p-1 bg-[#2980b9] text-white rounded disabled:opacity-60"
                      aria-label="Eliminar alternativa"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                  <td className="p-2 border">{alt.description}</td>
                  <td className="p-2 border text-center">
                    {alt.evaluate_profitability ? '✓' : '—'}
                  </td>
                  <td className="p-2 border text-center">{alt.evaluate_cost ? '✓' : '—'}</td>
                  <td className="p-2 border text-center">
                    {alt.proceeds_to_preparation ? '✓' : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
