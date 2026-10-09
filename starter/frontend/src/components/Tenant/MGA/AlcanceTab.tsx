import { useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type ProjectMgaFormulation } from '../../../store/projectMgaStore';
import MgaAccordion from './MgaAccordion';
import MgaActionButtons from './MgaActionButtons';
import MgaAlert from './MgaAlert';
import { CountedTextarea } from '../../ui/CountedTextarea';

/** Genera el texto guía del alcance a partir de objetivos, productos, indicadores y localización. */
export function buildAlcanceText(formulation: ProjectMgaFormulation, altId: string): string {
  const objetivos = formulation.identificacion?.objetivos;
  const cadena = formulation.preparacion?.cadenaValorPrep?.[altId]?.objetivos || {};
  const indicadoresProducto = formulation.programacion?.indicadoresProducto || {};
  const especificos = objetivos?.objetivosEspecificos || {};
  const parts: string[] = [];

  Object.entries(cadena).forEach(([objId, obj], i) => {
    parts.push(`(OBJETIVO ESPECÍFICO ${i + 1}) "${especificos[objId] || objId}"`);
    (obj.productos || []).forEach((prod, j) => {
      const indicador = (indicadoresProducto[prod.id] || [])[0];
      const nombreProd = [prod.descripcion, prod.complemento].filter(Boolean).join(' - ');
      parts.push(
        `(PRODUCTO ${i + 1}.${j + 1}) "${nombreProd}" Medido a través de: "${indicador?.nombre ?? ''}", Cantidad: "${prod.cantidad ?? ''}"`,
      );
    });
  });

  parts.push(`Con el fin de (OBJETIVO GENERAL) "${objetivos?.objetivoGeneral || ''}"`);
  (objetivos?.indicadores || []).forEach((ind, i) => {
    parts.push(`(INDICADOR OBJETIVO GENERAL ${i + 1}) "${ind.indicador}", ${ind.unidadMedida}, "${ind.meta}"`);
  });

  const ubicaciones = formulation.localizacionPreparacion?.[altId]?.ubicaciones || [];
  ubicaciones.forEach((u) => {
    parts.push(`(LOCALIZACIÓN) <${u.departamento}, ${u.municipio}>`);
  });

  return parts.join(' ');
}

export default function AlcanceTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveEvaluacion = useProjectMgaStore((s) => s.saveEvaluacion);

  const [accordion1Open, setAccordion1Open] = useState(true);
  const [accordion2Open, setAccordion2Open] = useState(true);
  const [alcance, setAlcance] = useState<string>(formulation.evaluacion?.alcance || '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const alternatives = (formulation.identificacion?.alternativas || []).filter(
    (alt: any) => alt.pasaPreparacion === true,
  );
  const selectedId = formulation.evaluacion?.alternativaSeleccionadaId;
  const altId =
    (selectedId && alternatives.some((a: any) => a.id === selectedId) ? selectedId : alternatives[0]?.id) || '';

  const alcanceGuia = useMemo(() => buildAlcanceText(formulation, altId), [formulation, altId]);

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    try {
      const existing = useProjectMgaStore.getState().getFormulation(project.id).evaluacion || {};
      await saveEvaluacion(project.id, { ...existing, alcance });
      setMessage('Alcance guardado exitosamente.');
    } catch {
      setError('Error al guardar el alcance');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Alcance</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      <div>
        <label htmlFor="alcance-alternativa" className="block text-xs font-semibold text-slate-700 mb-1.5">
          Seleccione la alternativa:
        </label>
        <select
          id="alcance-alternativa"
          value={altId}
          disabled
          className="w-full p-2.5 text-sm border border-slate-300 rounded-lg outline-none bg-slate-100 text-slate-600 cursor-not-allowed"
        >
          <option value="">-- Seleccione una alternativa --</option>
          {alternatives.map((alt: any) => (
            <option key={alt.id} value={alt.id}>
              {alt.nombre || alt.description || 'Alternativa sin nombre'}
            </option>
          ))}
        </select>
      </div>

      <MgaAccordion
        number="01"
        title="Confirmación del alcance"
        open={accordion1Open}
        onToggle={() => setAccordion1Open(!accordion1Open)}
      >
        <p className="text-xs font-semibold text-slate-700 mb-2">
          Alcance construido a partir de información del proyecto
        </p>
        <div className="bg-slate-50 border rounded p-3 text-xs text-slate-700 whitespace-pre-wrap" data-testid="alcance-guia">
          {alcanceGuia || 'No hay información suficiente para construir el alcance.'}
        </div>
      </MgaAccordion>

      <MgaAccordion
        number="02"
        title="Redacción del alcance"
        open={accordion2Open}
        onToggle={() => setAccordion2Open(!accordion2Open)}
      >
        <h3 className="text-sm font-semibold text-slate-700 mb-1">
          Alcance y metas del proyecto <span className="text-red-500">*</span>
        </h3>
        <p className="text-xs text-slate-500 mb-2">
          En el siguiente campo debe describir con sus palabras el alcance del proyecto. No olvide que este alcance
          debe incluir la articulación del objetivo general, los objetivos específicos, los productos y la
          localización. Las metas como información adicional permiten validar la consistencia del proyecto. El cuadro
          superior es una guía para desarrollar el alcance.
        </p>
        <CountedTextarea
          spellCheck={true}
          rows={10}
          maxLength={4000}
          value={alcance}
          onChange={(e) => setAlcance(e.target.value)}
          className="w-full p-2 border rounded text-sm"
        />
      </MgaAccordion>

      <div className="mt-8">
        <MgaActionButtons project={project} onSave={handleSave} />
      </div>
    </div>
  );
}
