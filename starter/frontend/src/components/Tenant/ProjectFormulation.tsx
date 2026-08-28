import { type FormEvent, useEffect, useState } from 'react';
import AIAssistedField from '../AuroraAsistente/AIAssistedField';
import { useProjectStore, type Project } from '../../store/projectStore';

type ProjectFormulationProps = {
  project: Project;
};

export default function ProjectFormulation({ project }: ProjectFormulationProps) {
  const updateProjectDetails = useProjectStore((s) => s.updateProjectDetails);
  const isSaving = useProjectStore((s) => s.isSaving);

  const [problemDescription, setProblemDescription] = useState(project.problem_description ?? '');
  const [generalObjective, setGeneralObjective] = useState(project.general_objective ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProblemDescription(project.problem_description ?? '');
    setGeneralObjective(project.general_objective ?? '');
  }, [project.id, project.problem_description, project.general_objective]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    try {
      await updateProjectDetails(project.id, {
        problem_description: problemDescription,
        general_objective: generalObjective,
      });
      setMessage('Formulación guardada correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow border border-gray-100 p-6 space-y-5">
      <div className="flex items-center gap-2 text-[#006162]">
        <span className="material-symbols-outlined">edit_note</span>
        <h3 className="text-lg font-semibold text-gray-800">Formulación MGA</h3>
      </div>

      <AIAssistedField
        label="Descripción del problema"
        htmlFor="problem_description"
        guidance="Describa el problema central con evidencia (magnitud, población afectada y territorio). Evite soluciones disfrazadas: el problema debe ser una situación negativa verificable, alineada con el árbol de problemas MGA."
        askPrompt={`¿Cómo debería redactar la descripción del problema central para el proyecto "${project.name}" del sector ${project.sector ?? 'indicado'}? Dame un ejemplo breve según la metodología MGA del DNP.`}
      >
        <textarea
          id="problem_description"
          rows={5}
          value={problemDescription}
          onChange={(e) => setProblemDescription(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#006162] resize-y"
          placeholder="Describe el problema central que el proyecto busca resolver…"
        />
      </AIAssistedField>

      <AIAssistedField
        label="Objetivo general"
        htmlFor="general_objective"
        guidance="El objetivo general expresa el cambio esperado en la población o territorio. Formúlelo como un resultado alcanzable (infinitivo o enunciado afirmativo), coherente con el problema central y medible a través de indicadores."
        askPrompt={`¿Cómo debería redactar el objetivo general del proyecto "${project.name}"? Propón una redacción alineada al manual de procedimientos de inversión pública del DNP.`}
      >
        <textarea
          id="general_objective"
          rows={4}
          value={generalObjective}
          onChange={(e) => setGeneralObjective(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#006162] resize-y"
          placeholder="Define el objetivo general del proyecto…"
        />
      </AIAssistedField>

      {message && (
        <div className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-[#006162]">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-1 rounded bg-[#006162] hover:bg-[#004f50] disabled:opacity-60 text-white px-4 py-2 text-sm font-medium"
        >
          <span className="material-symbols-outlined text-base">save</span>
          {isSaving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
