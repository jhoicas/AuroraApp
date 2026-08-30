import { useState } from 'react';
import { HelpCircle, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import type { MgaParticipant } from '../../../lib/mgaApi';
import MgaAlert from './MgaAlert';

type ParticipantesTabProps = {
  project: Project;
};

const EMPTY_DRAFT = {
  actor: '',
  entity: '',
  position: '',
  interests: '',
  contribution: '',
};

export default function ParticipantesTab({ project }: ParticipantesTabProps) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const addParticipant = useProjectMgaStore((s) => s.addParticipant);
  const editParticipant = useProjectMgaStore((s) => s.editParticipant);
  const removeParticipant = useProjectMgaStore((s) => s.removeParticipant);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const { participants } = getFormulation(project.id);

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!draft.actor.trim() || !draft.entity.trim()) {
      setError('Actor y entidad son obligatorios.');
      return;
    }
    setError(null);
    const payload = {
      actor: draft.actor.trim(),
      entity: draft.entity.trim(),
      position: draft.position.trim(),
      interests: draft.interests.trim(),
      contribution: draft.contribution.trim(),
    };
    try {
      if (editingId) {
        await editParticipant(project.id, editingId, payload);
        setMessage('Participante actualizado.');
      } else {
        await addParticipant(project.id, payload);
        setMessage('Participante creado.');
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el participante');
    }
  };

  const startEdit = (p: MgaParticipant) => {
    setEditingId(p.id);
    setDraft({
      actor: p.actor,
      entity: p.entity,
      position: p.position,
      interests: p.interests,
      contribution: p.contribution,
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este participante?')) return;
    setError(null);
    try {
      await removeParticipant(project.id, id);
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el participante');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Participantes</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      <div className="grid gap-3 sm:grid-cols-2 border rounded p-4 bg-gray-50">
        <div>
          <label className="font-semibold text-gray-600 block mb-1">Actor</label>
          <input
            type="text"
            value={draft.actor}
            onChange={(e) => setDraft((d) => ({ ...d, actor: e.target.value }))}
            className="w-full p-2 border rounded bg-white"
            placeholder="Ej. Comunidad, entidad pública…"
          />
        </div>
        <div>
          <label className="font-semibold text-gray-600 block mb-1">Entidad</label>
          <input
            type="text"
            value={draft.entity}
            onChange={(e) => setDraft((d) => ({ ...d, entity: e.target.value }))}
            className="w-full p-2 border rounded bg-white"
            placeholder="Nombre de la entidad"
          />
        </div>
        <div>
          <label className="font-semibold text-gray-600 block mb-1">Posición</label>
          <input
            type="text"
            value={draft.position}
            onChange={(e) => setDraft((d) => ({ ...d, position: e.target.value }))}
            className="w-full p-2 border rounded bg-white"
            placeholder="Ej. Favorable, neutral, en contra…"
          />
        </div>
        <div className="sm:col-span-2">
          <AIAssistedField
            label="Intereses"
            htmlFor={`participant-interests-${project.id}`}
            compact
            guidance="Describa los intereses del actor respecto al proyecto: beneficios esperados, riesgos percibidos y motivaciones."
            askPrompt={`¿Cómo redacto los intereses del actor "${draft.actor || 'participante'}" en la formulación MGA del proyecto "${project.name}"?`}
          >
            <textarea
              id={`participant-interests-${project.id}`}
              rows={2}
              value={draft.interests}
              onChange={(e) => setDraft((d) => ({ ...d, interests: e.target.value }))}
              className="w-full p-2 border rounded bg-white"
            />
          </AIAssistedField>
        </div>
        <div className="sm:col-span-2">
          <AIAssistedField
            label="Contribuciones"
            htmlFor={`participant-contribution-${project.id}`}
            compact
            guidance="Indique qué aporta el participante al proyecto: recursos, conocimiento, legitimidad, gestión del territorio, etc."
            askPrompt={`¿Qué contribuciones puede aportar "${draft.entity || 'esta entidad'}" al proyecto "${project.name}" según MGA?`}
          >
            <textarea
              id={`participant-contribution-${project.id}`}
              rows={2}
              value={draft.contribution}
              onChange={(e) => setDraft((d) => ({ ...d, contribution: e.target.value }))}
              className="w-full p-2 border rounded bg-white"
            />
          </AIAssistedField>
        </div>
        <div className="sm:col-span-2 flex flex-wrap justify-end gap-2">
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
            {editingId ? 'Actualizar' : 'Adicionar participante'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-left">
          <thead className="bg-[#6c757d] text-white">
            <tr>
              <th className="p-2 border">Acciones</th>
              <th className="p-2 border">Actor</th>
              <th className="p-2 border">Entidad</th>
              <th className="p-2 border">Posición</th>
              <th className="p-2 border">Intereses</th>
              <th className="p-2 border">Contribuciones</th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No hay participantes registrados.
                </td>
              </tr>
            ) : (
              participants.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50 align-top">
                  <td className="p-2 border text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      disabled={isSaving}
                      className="p-1 bg-[#2980b9] text-white rounded mr-1 disabled:opacity-60"
                      aria-label="Editar participante"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(p.id)}
                      disabled={isSaving}
                      className="p-1 bg-[#2980b9] text-white rounded disabled:opacity-60"
                      aria-label="Eliminar participante"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                  <td className="p-2 border font-medium">{p.actor}</td>
                  <td className="p-2 border">{p.entity}</td>
                  <td className="p-2 border">{p.position || '—'}</td>
                  <td className="p-2 border max-w-xs">{p.interests || '—'}</td>
                  <td className="p-2 border max-w-xs">{p.contribution || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
