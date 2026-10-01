import { useState, useEffect, useRef } from 'react';
import { HelpCircle, Plus, Trash2, Pencil } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, debouncedPatchProject, type ArbolNodoCausa, type ObjetivosJson, type IndicadorObjetivoJson } from '../../../store/projectMgaStore';
import MgaAccordion from './MgaAccordion';
import MgaAlert from './MgaAlert';
import MgaActionButtons from './MgaActionButtons';
import { CountedTextarea } from '../../ui/CountedTextarea';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import { STRONG_VERBS } from '../../../constants/mgaVerbs';

const MEASUREMENT_UNITS = [
  'Área',
  'Bytes',
  'Galones',
  'Hectáreas',
  'Kilogramos',
  'Metros cuadrados',
  'Metros cúbicos',
  'Metros lineales',
  'Millones de pesos',
  'Número',
  'Porcentaje',
  'Toneladas',
  'Semanas',
  'Meses',
  'Puntaje',
];

const SOURCE_TYPES = [
  'Documento oficial',
  'Encuesta',
  'Entrevista',
  'Estadísticas',
  'Evaluación',
  'Informe',
  'Inspección',
  'Registros contables',
];

const EMPTY_OBJETIVOS: ObjetivosJson = {
  objetivoGeneral: '',
  indicadores: [],
  objetivosEspecificos: {},
};

const EMPTY_INDICATOR: IndicadorObjetivoJson = {
  id: '',
  indicador: '',
  unidadMedida: '',
  meta: 0,
  tipoFuente: SOURCE_TYPES[0],
  fuenteVerificacion: '',
};

type ObjetivosTabProps = {
  project: Project;
};

export default function ObjetivosTab({ project }: ObjetivosTabProps) {
  const [error, setError] = useState<string | null>(null);

  const [openSections, setOpenSections] = useState({
    general: true,
    relaciones: true,
  });

  const [objetivos, setObjetivos] = useState<ObjetivosJson>({ ...EMPTY_OBJETIVOS });
  
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [indicatorForm, setIndicatorForm] = useState<IndicadorObjetivoJson>({ ...EMPTY_INDICATOR });
  
  const [editingObjId, setEditingObjId] = useState<string | null>(null);
  const [editingObjValue, setEditingObjValue] = useState<string>('');

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>('');

  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const problematica = formulation?.identificacion?.problematica;
  const problemaCentral = problematica?.problemaCentral || project.problem_description || '';
  const fetchFormulation = useProjectMgaStore((s) => s.fetchFormulation);

  useEffect(() => {
    let cancelled = false;

    const loadProblematica = async () => {
      try {
        await fetchFormulation(project.id);
      } catch {
        if (!cancelled) setError('No se pudo cargar la problemática del proyecto.');
      }
    };

    void loadProblematica();
    return () => {
      cancelled = true;
    };
  }, [fetchFormulation, project.id]);

  const storeObjetivos = useProjectMgaStore((s) => s.getFormulation(project.id)?.identificacion?.objetivos);

  useEffect(() => {
    if (storeObjetivos) {
      const serialized = JSON.stringify(storeObjetivos);
      if (serialized !== lastSavedRef.current) {
        setObjetivos(storeObjetivos);
        lastSavedRef.current = serialized;
      }
    }
  }, [storeObjetivos]);

  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      isFirstMount.current = true;
    }
  }, [project.id]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const serialized = JSON.stringify(objetivos);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    const curData = useProjectMgaStore.getState().getFormulation(project.id)?.identificacion;
    const updatedProblematica = curData?.problematica
      ? {
          ...curData.problematica,
          causas: curData.problematica.causas.map((causa) =>
            causa.tipo === 'directa' && Object.prototype.hasOwnProperty.call(objetivos.objetivosEspecificos, causa.id)
              ? { ...causa, specificObjective: objetivos.objetivosEspecificos[causa.id] }
              : causa,
          ),
        }
      : undefined;
    const updatedIdentificacion = {
      ...curData,
      ...(updatedProblematica ? { problematica: updatedProblematica } : {}),
      objetivos,
    };
    
    useProjectMgaStore.setState((state) => ({
      byProjectId: {
        ...state.byProjectId,
        [project.id]: {
          ...(state.byProjectId[project.id] ?? {}),
          identificacion: updatedIdentificacion,
        }
      }
    }));

    debouncedPatchProject(project.id, {
      identificacion: updatedIdentificacion,
    });
  }, [objetivos, project.id]);

  const updateObjetivos = (patch: Partial<ObjetivosJson>) => {
    setObjetivos((prev) => ({ ...prev, ...patch }));
  };

  const handleOpenAddIndicator = () => {
    setIndicatorForm({ ...EMPTY_INDICATOR, id: crypto.randomUUID() });
    setShowIndicatorModal(true);
  };

  const handleOpenEditIndicator = (ind: IndicadorObjetivoJson) => {
    setIndicatorForm({ ...ind });
    setShowIndicatorModal(true);
  };

  const handleSaveIndicator = () => {
    if (!indicatorForm.indicador.trim() || !indicatorForm.unidadMedida.trim()) {
      setError('El indicador y la unidad de medida son obligatorios.');
      return;
    }
    
    setObjetivos((prev) => {
      const exists = prev.indicadores.some(i => i.id === indicatorForm.id);
      let newIndicadores;
      if (exists) {
        newIndicadores = prev.indicadores.map(i => i.id === indicatorForm.id ? indicatorForm : i);
      } else {
        newIndicadores = [...prev.indicadores, indicatorForm];
      }
      return { ...prev, indicadores: newIndicadores };
    });
    
    setShowIndicatorModal(false);
    setError(null);
  };

  const handleDeleteIndicator = (id: string) => {
    setObjetivos((prev) => ({
      ...prev,
      indicadores: prev.indicadores.filter(i => i.id !== id)
    }));
  };

  const toggleEditing = (causaId: string, currentValue: string) => {
    if (editingObjId === causaId) {
      // Save
      setObjetivos((prev) => ({
        ...prev,
        objetivosEspecificos: {
          ...prev.objetivosEspecificos,
          [causaId]: editingObjValue
        }
      }));
      setEditingObjId(null);
      setEditingObjValue('');
    } else {
      // Edit
      setEditingObjId(causaId);
      setEditingObjValue(currentValue);
    }
  };

  const causesByParent = (problematica?.causas ?? []).reduce<Record<string, ArbolNodoCausa[]>>(
    (groups, causa) => {
      if (causa.parentId) {
        groups[causa.parentId] = [...(groups[causa.parentId] ?? []), causa];
      }
      return groups;
    },
    {},
  );

  const renderCauseRow = (causa: ArbolNodoCausa, isDirect: boolean) => {
    const isEditing = isDirect && editingObjId === causa.id;
    const currentObj = objetivos.objetivosEspecificos[causa.id] || causa.specificObjective || '';

    return (
      <tr key={causa.id} className={isDirect ? 'border-b hover:bg-slate-50' : 'border-b bg-slate-50/60'}>
        <td className={`p-2 font-medium ${isDirect ? 'text-slate-700' : 'pl-8 text-slate-500'}`}>
          {isDirect ? 'Causa directa' : 'Causa indirecta'}
        </td>
        <td className={`p-2 text-slate-700 ${!isDirect ? 'pl-8' : ''}`}>
          {causa.descripcion || 'Sin descripción registrada'}
        </td>
        <td className="p-2">
          {isDirect ? (
            isEditing ? (
              <AIAssistedField
                label="Objetivo específico asociado"
                htmlFor={`objetivo-especifico-${causa.id}`}
                required
                compact
                guidance="Convierta la causa directa en un objetivo específico usando un verbo activo y un resultado medible."
                validationValue={editingObjValue}
                validationRule="infinitive-verb"
                fieldHelpKey="objetivo_especifico"
                projectContext={{
                  projectName: project.name,
                  sector: project.sector,
                  problemDescription: problemaCentral,
                }}
                reactiveContext={{ causa: causa.descripcion }}
                onAutoFill={setEditingObjValue}
                askPrompt={`Ayúdame a redactar un objetivo específico para la causa: ${causa.descripcion}`}
                aiContext={`Actúa como experto en MGA. Redacta un Objetivo Específico para solucionar esta causa directa: '${causa.descripcion}'. REGLA ESTRICTA e INQUEBRANTABLE: La primera palabra del objetivo DEBE ser obligatoriamente un verbo en infinitivo de esta lista exacta: ${STRONG_VERBS.join(', ')}. Genera solo el texto del objetivo.`}
              >
                <CountedTextarea
                  id={`objetivo-especifico-${causa.id}`}
                  value={editingObjValue}
                  onChange={(e) => setEditingObjValue(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full rounded border border-blue-400 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </AIAssistedField>
            ) : (
              <span className={currentObj ? '' : 'text-slate-400 italic'}>
                {currentObj || 'Sin objetivo específico...'}
              </span>
            )
          ) : (
            <span className="text-slate-400 italic">No aplica para causas indirectas</span>
          )}
        </td>
        <td className="p-2 text-center">
          {isDirect && (
            <button
              type="button"
              onClick={() => toggleEditing(causa.id, currentObj)}
              className="rounded p-2 text-blue-600 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title={isEditing ? 'Guardar objetivo específico' : 'Editar objetivo específico'}
              aria-label={isEditing ? 'Guardar objetivo específico' : 'Editar objetivo específico'}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Objetivos generales y específicos</h1>
        <HelpCircle className="h-5 w-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      <div className="space-y-4 mt-6">
        <MgaAccordion 
          title="Objetivo general e indicadores de seguimiento" 
          number="01" 
          open={openSections.general} 
          onToggle={() => setOpenSections(prev => ({ ...prev, general: !prev.general }))}
        >
          <div className="space-y-6 p-1">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Problema central</label>
              <CountedTextarea
                readOnly
                value={problematica?.problemaCentral || 'No hay problema central definido en la pestaña de Problemática.'}
                className="w-full p-2.5 border border-slate-300 rounded bg-slate-50 text-slate-600 outline-none text-sm resize-none"
                rows={2}
                maxLength={500}
              />
            </div>
            <div>
              <AIAssistedField
                label="Objetivo general - Propósito"
                htmlFor="objetivo-general"
                required
                guidance="Formule el propósito con un verbo activo, un resultado concreto y un alcance verificable."
                validationValue={objetivos.objetivoGeneral}
                validationRule="infinitive-verb"
                fieldHelpKey="objetivo_general"
                projectContext={{
                  projectName: project.name,
                  sector: project.sector,
                  problemDescription: problemaCentral,
                }}
                reactiveContext={{ problemaCentral }}
                onAutoFill={(value) => updateObjetivos({ objetivoGeneral: value })}
                askPrompt={`Ayúdame a redactar el objetivo general del proyecto ${project.name}`}
                aiContext={`Actúa como experto en Metodología General Ajustada (MGA). Redacta el Objetivo General basado en este problema central: '${problemaCentral}'. REGLA ESTRICTA e INQUEBRANTABLE: La primera palabra del objetivo DEBE ser obligatoriamente un verbo en infinitivo de esta lista exacta: ${STRONG_VERBS.join(', ')}. Genera solo el texto del objetivo, sin introducciones.`}
              >
                <CountedTextarea
                  id="objetivo-general"
                  spellCheck
                  value={objetivos.objetivoGeneral}
                  onChange={(e) => updateObjetivos({ objetivoGeneral: e.target.value })}
                  placeholder="Redacte el objetivo general..."
                  className="w-full rounded border border-slate-300 bg-white p-2.5 text-sm outline-none focus:ring-1 focus:ring-[#006162]"
                  rows={3}
                  maxLength={500}
                />
              </AIAssistedField>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Indicadores para medir el objetivo general *</label>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b text-slate-600">
                      <th className="p-2 font-medium w-20 text-center">Acciones</th>
                      <th className="p-2 font-medium">Indicador objetivo</th>
                      <th className="p-2 font-medium">Medido a través de (Unidad)</th>
                      <th className="p-2 font-medium">Meta</th>
                      <th className="p-2 font-medium">Tipo fuente</th>
                      <th className="p-2 font-medium">Fuente de verificación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objetivos.indicadores.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500">
                          No hay indicadores registrados. Haga clic en "Adicionar" para registrar uno.
                        </td>
                      </tr>
                    ) : (
                      objetivos.indicadores.map((ind) => (
                        <tr key={ind.id} className="border-b hover:bg-slate-50">
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleOpenEditIndicator(ind)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded mr-1"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteIndicator(ind.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                          <td className="p-2">{ind.indicador}</td>
                          <td className="p-2">{ind.unidadMedida}</td>
                          <td className="p-2">{ind.meta}</td>
                          <td className="p-2">{ind.tipoFuente}</td>
                          <td className="p-2">{ind.fuenteVerificacion}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleOpenAddIndicator}
                className="mt-3 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 border border-slate-300 rounded hover:bg-slate-200 flex items-center gap-1.5 transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            </div>
          </div>
        </MgaAccordion>

        <MgaAccordion 
          title="Relaciones entre las causas y los objetivos" 
          number="02" 
          open={openSections.relaciones} 
          onToggle={() => setOpenSections(prev => ({ ...prev, relaciones: !prev.relaciones }))}
        >
          <div className="space-y-4 p-1">
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b text-slate-600">
                    <th className="p-2 font-medium w-32">Tipo</th>
                    <th className="p-2 font-medium w-1/3">Descripción de la causa</th>
                    <th className="p-2 font-medium">Objetivo específico asociado</th>
                    <th className="p-2 font-medium w-16 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {!problematica?.causas?.length ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500">
                        No hay causas registradas en el árbol de problemas.
                      </td>
                    </tr>
                  ) : (
                    (problematica.causas.filter((causa) => causa.tipo === 'directa')).flatMap((causa) => [
                      renderCauseRow(causa, true),
                      ...(causesByParent[causa.id] ?? []).map((indirecta) => renderCauseRow(indirecta, false)),
                    ])
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </MgaAccordion>
      </div>

      {showIndicatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-slate-50">
              <h3 className="font-medium text-slate-800">
                {indicatorForm.id && objetivos.indicadores.some(i => i.id === indicatorForm.id) ? 'Editar' : 'Nuevo'} Indicador
              </h3>
            </div>
            <div className="p-4 space-y-4 text-sm flex-1 overflow-y-auto">
              <AIAssistedField
                label="Nombre del indicador"
                htmlFor="indicador-nombre"
                required
                guidance="Use un nombre breve, observable y directamente relacionado con el objetivo general."
                validationValue={indicatorForm.indicador}
                askPrompt="Ayúdame a redactar el nombre de un indicador MGA medible."
              >
                <input
                  id="indicador-nombre"
                  type="text"
                  value={indicatorForm.indicador}
                  onChange={(e) => setIndicatorForm(prev => ({ ...prev, indicador: e.target.value }))}
                  className="w-full rounded border border-slate-300 p-2 outline-none focus:ring-1 focus:ring-[#006162]"
                />
              </AIAssistedField>
              <AIAssistedField
                label="Medido a través de"
                htmlFor="indicador-unidad"
                required
                guidance="Seleccione la unidad que permite cuantificar el indicador de forma objetiva."
              >
                <select
                  id="indicador-unidad"
                  value={indicatorForm.unidadMedida}
                  onChange={(e) => setIndicatorForm(prev => ({ ...prev, unidadMedida: e.target.value }))}
                  className="w-full rounded border border-slate-300 bg-white p-2 outline-none focus:ring-1 focus:ring-[#006162]"
                >
                  <option value="">Seleccione una unidad</option>
                  {MEASUREMENT_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </AIAssistedField>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Meta</label>
                <input
                  type="number"
                  value={indicatorForm.meta}
                  onChange={(e) => setIndicatorForm(prev => ({ ...prev, meta: parseFloat(e.target.value) || 0 }))}
                  className="w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none"
                />
              </div>
              <AIAssistedField
                label="Tipo de fuente"
                htmlFor="indicador-tipo-fuente"
                required
                guidance="Seleccione el tipo de evidencia que respalda la medición del indicador."
              >
                <select
                  id="indicador-tipo-fuente"
                  value={indicatorForm.tipoFuente}
                  onChange={(e) => setIndicatorForm(prev => ({ ...prev, tipoFuente: e.target.value }))}
                  className="w-full rounded border border-slate-300 bg-white p-2 outline-none focus:ring-1 focus:ring-[#006162]"
                >
                  {SOURCE_TYPES.map((sourceType) => <option key={sourceType} value={sourceType}>{sourceType}</option>)}
                </select>
              </AIAssistedField>
              <AIAssistedField
                label="Fuente de verificación"
                htmlFor="indicador-fuente-verificacion"
                required
                guidance="Describa el documento, registro o sistema donde podrá verificarse la medición."
                validationValue={indicatorForm.fuenteVerificacion}
                askPrompt="Ayúdame a describir una fuente de verificación para un indicador MGA."
              >
                <input
                  id="indicador-fuente-verificacion"
                  type="text"
                  value={indicatorForm.fuenteVerificacion}
                  onChange={(e) => setIndicatorForm(prev => ({ ...prev, fuenteVerificacion: e.target.value }))}
                  className="w-full rounded border border-slate-300 p-2 outline-none focus:ring-1 focus:ring-[#006162]"
                />
              </AIAssistedField>
            </div>
            <div className="px-4 py-3 border-t bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setShowIndicatorModal(false)}
                className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveIndicator}
                className="px-4 py-2 text-sm bg-[#006162] text-white rounded hover:bg-[#004d4e] transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <MgaActionButtons project={project} onSave={async () => {
          await useProjectMgaStore.getState().saveObjetivos(project.id);
        }} />
      </div>
    </div>
  );
}
