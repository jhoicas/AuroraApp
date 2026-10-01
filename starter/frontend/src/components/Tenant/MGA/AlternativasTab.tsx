import { useState, useEffect, useRef, useMemo } from 'react';
import { HelpCircle, Pencil, PlusCircle, Trash2, X, Check } from 'lucide-react';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type AlternativaJson, type EvaluacionesJson, type IdentificacionData } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import MgaActionButtons from './MgaActionButtons';
import { CountedTextarea } from '../../ui/CountedTextarea';
import type { ProjectContext } from '../../../data/mgaFieldsKnowledge';

type AlternativasTabProps = {
  project: Project;
};

const DEFAULT_EVALUACIONES: EvaluacionesJson = {
  rentabilidad: false,
  costoEficiencia: false,
  multicriterio: false,
};

export default function AlternativasTab({ project }: AlternativasTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const saveAlternativas = useProjectMgaStore((s) => s.saveAlternativas);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const initialIdentificacion = getFormulation(project.id)?.identificacion;
  
  const [alternativas, setAlternativas] = useState<AlternativaJson[]>(() => initialIdentificacion?.alternativas || []);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionesJson>(() => initialIdentificacion?.evaluaciones || DEFAULT_EVALUACIONES);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form draft
  const [nombre, setNombre] = useState('');
  const [pasaPreparacion, setPasaPreparacion] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>(JSON.stringify({
    alternativas: initialIdentificacion?.alternativas || [],
    evaluaciones: initialIdentificacion?.evaluaciones || DEFAULT_EVALUACIONES,
  }));

  const fieldProjectContext: ProjectContext = useMemo(() => {
    const formulation = useProjectMgaStore.getState().getFormulation(project.id);
    const objDict = formulation?.identificacion?.objetivos?.objetivosEspecificos || {};
    const objetivosList = Object.values(objDict).filter(Boolean);

    return {
      projectName: project.name,
      sector: project.sector || undefined,
      productCode: project.product_code || undefined,
      procesoName: (project as any)?.proceso_id ? String((project as any)?.proceso_id) : undefined,
      objeto: (project as any)?.objeto || undefined,
      additionalContext: objetivosList.length > 0 
        ? `Objetivos específicos generados previamente: ${objetivosList.join('; ')}`
        : undefined,
    };
  }, [project.name, project.sector, project.product_code, (project as any)?.proceso_id, (project as any)?.objeto, project.id]);

  const storeIdentificacion = useProjectMgaStore((s) => s.getFormulation(project.id)?.identificacion);

  // Sync state from store
  useEffect(() => {
    if (storeIdentificacion) {
      const dataToCompare = {
        alternativas: storeIdentificacion.alternativas || [],
        evaluaciones: storeIdentificacion.evaluaciones || DEFAULT_EVALUACIONES,
      };
      const serialized = JSON.stringify(dataToCompare);
      if (serialized !== lastSavedRef.current) {
        setAlternativas(dataToCompare.alternativas);
        setEvaluaciones(dataToCompare.evaluaciones);
        lastSavedRef.current = serialized;
      }
    }
  }, [storeIdentificacion]);

  // Reset form when project changes
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      setIsAdding(false);
      setEditingId(null);
    }
  }, [project.id]);

  // Auto-save effect
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const data: IdentificacionData = {
      alternativas,
      evaluaciones,
    };

    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    void saveAlternativas(project.id, data);
  }, [alternativas, evaluaciones, project.id, saveAlternativas]);

  const openForm = (alt?: AlternativaJson) => {
    setError(null);
    if (alt) {
      setEditingId(alt.id);
      setNombre(alt.nombre);
      setPasaPreparacion(alt.pasaPreparacion);
    } else {
      setEditingId(null);
      setNombre('');
      setPasaPreparacion(false);
    }
    setIsAdding(true);
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setNombre('');
    setPasaPreparacion(false);
    setError(null);
  };

  const handleSaveAlternativa = () => {
    if (!nombre.trim()) {
      setError('La descripción de la alternativa es obligatoria.');
      return;
    }
    setError(null);

    if (editingId) {
      setAlternativas(alternativas.map(a => a.id === editingId ? { ...a, nombre: nombre.trim(), pasaPreparacion } : a));
    } else {
      const newAlt: AlternativaJson = {
        id: crypto.randomUUID(),
        nombre: nombre.trim(),
        pasaPreparacion,
        estado: 'Completo'
      };
      setAlternativas([...alternativas, newAlt]);
    }
    closeForm();
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('¿Eliminar esta alternativa?')) return;
    setAlternativas(alternativas.filter(a => a.id !== id));
  };

  const toggleEvaluacion = (field: keyof EvaluacionesJson) => {
    if (alternativas.length === 0) return;

    if (field === 'rentabilidad' && evaluaciones.rentabilidad) {
      // Trying to uncheck rentabilidad
      const confirmUncheck = window.confirm(
        "Al no realizar la evaluación de 'Rentabilidad', algunos capítulos del módulo de preparación no serán visualizados, y perderá la información ya ingresada. ¿Está seguro de continuar?"
      );
      if (!confirmUncheck) {
        return; // do not change the state if canceled
      }
    }

    setEvaluaciones(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Alternativas de solución</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      {!isAdding ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => openForm()}
              className="flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white font-semibold rounded disabled:opacity-60"
            >
              <PlusCircle className="w-4 h-4" />
              Adicionar Alternativa
            </button>
          </div>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-left">
              <thead className="bg-[#6c757d] text-white">
                <tr>
                  <th className="p-2 border">Acciones</th>
                  <th className="p-2 border">Alternativa</th>
                  <th className="p-2 border text-center">Se evaluará con esta herramienta</th>
                  <th className="p-2 border text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {alternativas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500">
                      No hay alternativas registradas. Haga clic en Adicionar.
                    </td>
                  </tr>
                ) : (
                  alternativas.map((alt) => (
                    <tr key={alt.id} className="border-b hover:bg-gray-50 align-top">
                      <td className="p-2 border text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openForm(alt)}
                          disabled={isSaving}
                          className="p-1 bg-[#2980b9] text-white rounded mr-1 disabled:opacity-60"
                          aria-label="Editar alternativa"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(alt.id)}
                          disabled={isSaving}
                          className="p-1 bg-[#2980b9] text-white rounded disabled:opacity-60"
                          aria-label="Eliminar alternativa"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="p-2 border">{alt.nombre}</td>
                      <td className="p-2 border text-center">
                        {alt.pasaPreparacion ? 'Sí' : 'No'}
                      </td>
                      <td className="p-2 border text-center">
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-[10px] font-semibold">Completo</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="border rounded p-4 bg-gray-50 space-y-3">
          <h3 className="font-semibold text-slate-700">{editingId ? 'Editar Alternativa' : 'Nueva Alternativa'}</h3>
          <AIAssistedField
            label="Nombre / descripción de la alternativa"
            htmlFor={`alt-desc-${project.id}`}
            required
            guidance="Describa cada alternativa de manera diferenciada: qué acción se propone, cómo atiende las causas y por qué es viable según MGA."
            askPrompt={`¿Qué alternativas de solución debo plantear para el proyecto "${project.name}" y cómo las redacto según MGA?`}
            fieldHelpKey="alternativa_solucion"
            projectContext={fieldProjectContext}
            reactiveContext={{ nombre }}
            currentValue={nombre}
            onAutoFill={(v) => setNombre(v)}
            maxLength={250}
          >
            <CountedTextarea spellCheck={true}
              id={`alt-desc-${project.id}`}
              rows={3}
              maxLength={250}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded bg-white mt-1 focus:border-emerald-500 focus:ring-emerald-500 outline-none"
              placeholder="Describa la alternativa…"
            />
          </AIAssistedField>

          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pasaPreparacion}
                onChange={(e) => setPasaPreparacion(e.target.checked)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700 font-medium">Pasa a preparación</span>
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex items-center gap-1 px-4 py-1.5 border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors rounded text-sm"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveAlternativa}
              className="inline-flex items-center gap-1 px-4 py-1.5 bg-[#2980b9] text-white font-medium hover:bg-[#20638f] transition-colors shadow-sm rounded text-sm"
            >
              <Check className="w-4 h-4" /> {editingId ? 'Actualizar' : 'Aceptar'}
            </button>
          </div>
        </div>
      )}

      {/* Evaluaciones Section */}
      <div className="mt-8 pt-4 border-t border-slate-200 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm">Evaluaciones a realizar</h3>
        <p className="text-slate-500 mb-2">Seleccione con qué herramienta se evaluarán las alternativas.</p>
        <div className="flex flex-col gap-3">
          <label className={`flex items-center gap-2 ${alternativas.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={evaluaciones.rentabilidad}
              disabled={alternativas.length === 0}
              onChange={() => toggleEvaluacion('rentabilidad')}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
            />
            <span className="text-sm font-medium text-slate-700">Rentabilidad</span>
          </label>
          <label className={`flex items-center gap-2 ${alternativas.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={evaluaciones.costoEficiencia}
              disabled={alternativas.length === 0}
              onChange={() => toggleEvaluacion('costoEficiencia')}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
            />
            <span className="text-sm font-medium text-slate-700">Costo - Eficiencia y Costo mínimo</span>
          </label>
          <label className={`flex items-center gap-2 ${alternativas.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={evaluaciones.multicriterio}
              disabled={alternativas.length === 0}
              onChange={() => toggleEvaluacion('multicriterio')}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
            />
            <span className="text-sm font-medium text-slate-700">Evaluación multicriterio</span>
          </label>
        </div>
      </div>

      <div className="mt-8">
        <MgaActionButtons project={project} />
      </div>

    </div>
  );
}
