import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { type Project } from '../../../store/projectStore';
import { useProjectMgaStore, type PlanDesarrolloData, type PlanDesarrolloPndLink } from '../../../store/projectMgaStore';
import MgaAccordion from './MgaAccordion';
import MgaActionButtons from './MgaActionButtons';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import PndSelectionModal from './PndSelectionModal';
import { type CatalogPnd } from '../../../store/catalogStore';
import type { ProjectContext } from '../../../data/mgaFieldsKnowledge';

export default function PlanDesarrolloTab({ project }: { project: Project }) {
  const [openAccordion, setOpenAccordion] = useState<string>('01');
  const [isPndModalOpen, setIsPndModalOpen] = useState(false);
  
  const savePlanDesarrollo = useProjectMgaStore((s) => s.savePlanDesarrollo);

  const initialPlanDesarrollo = useProjectMgaStore.getState().getFormulation(project.id)?.planDesarrollo;

  const [pnd, setPnd] = useState<PlanDesarrolloPndLink[]>(() => initialPlanDesarrollo?.pnd || []);
  
  const [depPlan, setDepPlan] = useState(() => initialPlanDesarrollo?.departamental?.plan || '');
  const [depEstrategia, setDepEstrategia] = useState(() => initialPlanDesarrollo?.departamental?.estrategia || '');
  const [depPrograma, setDepPrograma] = useState(() => initialPlanDesarrollo?.departamental?.programa || '');

  const [munPlan, setMunPlan] = useState(() => initialPlanDesarrollo?.municipal?.plan || '');
  const [munEstrategia, setMunEstrategia] = useState(() => initialPlanDesarrollo?.municipal?.estrategia || '');
  const [munPrograma, setMunPrograma] = useState(() => initialPlanDesarrollo?.municipal?.programa || '');

  const [etniasComunidad, setEtniasComunidad] = useState(() => initialPlanDesarrollo?.etnias?.tipoComunidad || '');
  const [etniasInstrumentos, setEtniasInstrumentos] = useState(() => initialPlanDesarrollo?.etnias?.instrumentos || '');

  const fieldProjectContext: ProjectContext = useMemo(() => ({
    projectName: project.name,
    sector: project.sector || undefined,
    productCode: project.product_code || undefined,
    procesoName: (project as any)?.proceso_id ? String((project as any)?.proceso_id) : undefined,
    objeto: (project as any)?.objeto || undefined,
  }), [project.name, project.sector, project.product_code, (project as any)?.proceso_id, (project as any)?.objeto]);

  const reactiveContext = useMemo(() => ({
    depPlan, depEstrategia, depPrograma,
    munPlan, munEstrategia, munPrograma,
    etniasComunidad, etniasInstrumentos
  }), [
    depPlan, depEstrategia, depPrograma,
    munPlan, munEstrategia, munPrograma,
    etniasComunidad, etniasInstrumentos
  ]);

  const handleToggle = (id: string) => {
    setOpenAccordion(openAccordion === id ? '' : id);
  };

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>(JSON.stringify({
    pnd: initialPlanDesarrollo?.pnd || [],
    departamental: {
      plan: initialPlanDesarrollo?.departamental?.plan || '',
      estrategia: initialPlanDesarrollo?.departamental?.estrategia || '',
      programa: initialPlanDesarrollo?.departamental?.programa || '',
    },
    municipal: {
      plan: initialPlanDesarrollo?.municipal?.plan || '',
      estrategia: initialPlanDesarrollo?.municipal?.estrategia || '',
      programa: initialPlanDesarrollo?.municipal?.programa || '',
    },
    etnias: {
      tipoComunidad: initialPlanDesarrollo?.etnias?.tipoComunidad || '',
      instrumentos: initialPlanDesarrollo?.etnias?.instrumentos || '',
    }
  }));

  // Sync state if project changes
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      const currentData = useProjectMgaStore.getState().getFormulation(project.id)?.planDesarrollo;
      setPnd(currentData?.pnd || []);
      setDepPlan(currentData?.departamental?.plan || '');
      setDepEstrategia(currentData?.departamental?.estrategia || '');
      setDepPrograma(currentData?.departamental?.programa || '');
      setMunPlan(currentData?.municipal?.plan || '');
      setMunEstrategia(currentData?.municipal?.estrategia || '');
      setMunPrograma(currentData?.municipal?.programa || '');
      setEtniasComunidad(currentData?.etnias?.tipoComunidad || '');
      setEtniasInstrumentos(currentData?.etnias?.instrumentos || '');
      lastSavedRef.current = JSON.stringify({
        pnd: currentData?.pnd || [],
        departamental: {
          plan: currentData?.departamental?.plan || '',
          estrategia: currentData?.departamental?.estrategia || '',
          programa: currentData?.departamental?.programa || '',
        },
        municipal: {
          plan: currentData?.municipal?.plan || '',
          estrategia: currentData?.municipal?.estrategia || '',
          programa: currentData?.municipal?.programa || '',
        },
        etnias: {
          tipoComunidad: currentData?.etnias?.tipoComunidad || '',
          instrumentos: currentData?.etnias?.instrumentos || '',
        }
      });
    }
  }, [project.id]);

  // Save changes when user edits fields, guarded to avoid redundant saves and mount loops
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const data: PlanDesarrolloData = {
      pnd,
      departamental: { plan: depPlan, estrategia: depEstrategia, programa: depPrograma },
      municipal: { plan: munPlan, estrategia: munEstrategia, programa: munPrograma },
      etnias: { tipoComunidad: etniasComunidad, instrumentos: etniasInstrumentos }
    };

    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    void savePlanDesarrollo(project.id, data);
  }, [
    pnd, depPlan, depEstrategia, depPrograma, 
    munPlan, munEstrategia, munPrograma, 
    etniasComunidad, etniasInstrumentos, 
    project.id, savePlanDesarrollo
  ]);

  const addPndLink = (pndItem: CatalogPnd) => {
    setPnd([...pnd, { 
      id: crypto.randomUUID(), 
      transformacion: pndItem.PillarDescription, 
      pilar: pndItem.ObjectiveDescription, 
      catalizador: pndItem.StrategyDescription, 
      componente: pndItem.ComponentDescription 
    }]);
    setIsPndModalOpen(false);
  };

  const updatePndLink = (id: string, field: keyof PlanDesarrolloPndLink, value: string) => {
    setPnd(pnd.map(link => link.id === id ? { ...link, [field]: value } : link));
  };

  const deletePndLink = (id: string) => {
    setPnd(pnd.filter(link => link.id !== id));
  };

  const handleSave = async () => {
    const data: PlanDesarrolloData = {
      pnd,
      departamental: { plan: depPlan, estrategia: depEstrategia, programa: depPrograma },
      municipal: { plan: munPlan, estrategia: munEstrategia, programa: munPrograma },
      etnias: { tipoComunidad: etniasComunidad, instrumentos: etniasInstrumentos }
    };
    lastSavedRef.current = JSON.stringify(data);
    return savePlanDesarrollo(project.id, data);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      
      <MgaAccordion
        number="01"
        title="Contribución al Plan Nacional de Desarrollo"
        open={openAccordion === '01'}
        onToggle={() => handleToggle('01')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-base font-medium text-slate-700 mb-1">Programa</label>
            <input spellCheck={true} 
              readOnly 
              type="text" 
              value={project.sector || ''} 
              className="w-full bg-slate-100 text-slate-700 border-slate-300 rounded px-3 py-2 text-base" 
            />
          </div>
          <div>
            <label className="block text-base font-medium text-slate-700 mb-1">Plan Nacional de Desarrollo</label>
            <input spellCheck={true} 
              readOnly 
              type="text" 
              value="(2022-2026) Colombia Potencia Mundial de la Vida" 
              className="w-full bg-slate-100 text-slate-700 border-slate-300 rounded px-3 py-2 text-base" 
            />
          </div>

          <div className="mt-4">
            <h4 className="font-semibold text-slate-700 text-base mb-2">Alineación PND</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-medium">
                  <tr>
                    <th className="px-4 py-2">Transformación</th>
                    <th className="px-4 py-2">Pilar</th>
                    <th className="px-4 py-2">Catalizador</th>
                    <th className="px-4 py-2">Componente</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pnd.map((link) => (
                    <tr key={link.id}>
                      <td className="px-2 py-2">
                        <input spellCheck={true} 
                          type="text" 
                          value={link.transformacion} 
                          onChange={(e) => updatePndLink(link.id, 'transformacion', e.target.value)} 
                          className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-2 py-1 text-sm" 
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input spellCheck={true} 
                          type="text" 
                          value={link.pilar} 
                          onChange={(e) => updatePndLink(link.id, 'pilar', e.target.value)} 
                          className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-2 py-1 text-sm" 
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input spellCheck={true} 
                          type="text" 
                          value={link.catalizador} 
                          onChange={(e) => updatePndLink(link.id, 'catalizador', e.target.value)} 
                          className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-2 py-1 text-sm" 
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input spellCheck={true} 
                          type="text" 
                          value={link.componente} 
                          onChange={(e) => updatePndLink(link.id, 'componente', e.target.value)} 
                          className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-2 py-1 text-sm" 
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button 
                          onClick={() => deletePndLink(link.id)} 
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pnd.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-slate-500">
                        No hay alineaciones agregadas. Utilice el botón "+ Adicionar".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <button 
              type="button" 
              onClick={() => setIsPndModalOpen(true)} 
              className="mt-3 inline-flex items-center gap-1 bg-blue-600 text-white font-medium hover:bg-blue-700 px-3 py-1.5 rounded-md text-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Agregar desde catálogo
            </button>
          </div>
        </div>
      </MgaAccordion>

      <PndSelectionModal 
        isOpen={isPndModalOpen} 
        onClose={() => setIsPndModalOpen(false)} 
        onSelect={addPndLink} 
      />

      <MgaAccordion
        number="02"
        title="Plan de Desarrollo Departamental o Sectorial"
        open={openAccordion === '02'}
        onToggle={() => handleToggle('02')}
      >
        <div className="space-y-4">
          <AIAssistedField
            label="Plan de Desarrollo Departamental o Sectorial"
            htmlFor="dep-plan"
            fieldHelpKey="plan_desarrollo"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={depPlan}
            onAutoFill={(v) => setDepPlan(v)}
            maxLength={1500}
          >
            <textarea spellCheck={true} 
              id="dep-plan"
              maxLength={1500} 
              rows={3} 
              value={depPlan} 
              onChange={(e) => setDepPlan(e.target.value)} 
              placeholder="Diligencie el nombre del Plan Departamental de Desarrollo si es entidad territorial." 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base resize-none mt-1" 
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{depPlan.length} / 1500</p>
          </AIAssistedField>
          <AIAssistedField
            label="Estrategia"
            htmlFor="dep-estrategia"
            fieldHelpKey="estrategia_desarrollo"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={depEstrategia}
            onAutoFill={(v) => setDepEstrategia(v)}
            maxLength={1500}
          >
            <textarea spellCheck={true} 
              id="dep-estrategia"
              maxLength={1500} 
              rows={3} 
              value={depEstrategia} 
              onChange={(e) => setDepEstrategia(e.target.value)} 
              placeholder="Diligencie el nombre de la estrategia" 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base resize-none mt-1" 
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{depEstrategia.length} / 1500</p>
          </AIAssistedField>
          <AIAssistedField
            label="Programa"
            htmlFor="dep-programa"
            fieldHelpKey="programa_desarrollo"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={depPrograma}
            onAutoFill={(v) => setDepPrograma(v)}
            maxLength={1500}
          >
            <textarea spellCheck={true} 
              id="dep-programa"
              maxLength={1500} 
              rows={3} 
              value={depPrograma} 
              onChange={(e) => setDepPrograma(e.target.value)} 
              placeholder="Diligencie el nombre del programa" 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base resize-none mt-1" 
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{depPrograma.length} / 1500</p>
          </AIAssistedField>
        </div>
      </MgaAccordion>

      <MgaAccordion
        number="03"
        title="Plan de Desarrollo Distrital o Municipal"
        open={openAccordion === '03'}
        onToggle={() => handleToggle('03')}
      >
        <div className="space-y-4">
          <AIAssistedField
            label="Plan de Desarrollo Distrital o Municipal"
            htmlFor="mun-plan"
            fieldHelpKey="plan_desarrollo"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={munPlan}
            onAutoFill={(v) => setMunPlan(v)}
            maxLength={1500}
          >
            <textarea spellCheck={true} 
              id="mun-plan"
              maxLength={1500} 
              rows={3} 
              value={munPlan} 
              onChange={(e) => setMunPlan(e.target.value)} 
              placeholder="Diligencie el nombre del Plan de Desarrollo Distrital o Municipal" 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base resize-none mt-1" 
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{munPlan.length} / 1500</p>
          </AIAssistedField>
          <AIAssistedField
            label="Estrategia"
            htmlFor="mun-estrategia"
            fieldHelpKey="estrategia_desarrollo"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={munEstrategia}
            onAutoFill={(v) => setMunEstrategia(v)}
            maxLength={1500}
          >
            <textarea spellCheck={true} 
              id="mun-estrategia"
              maxLength={1500} 
              rows={3} 
              value={munEstrategia} 
              onChange={(e) => setMunEstrategia(e.target.value)} 
              placeholder="Diligencie el nombre de la estrategia" 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base resize-none mt-1" 
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{munEstrategia.length} / 1500</p>
          </AIAssistedField>
          <AIAssistedField
            label="Programa"
            htmlFor="mun-programa"
            fieldHelpKey="programa_desarrollo"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={munPrograma}
            onAutoFill={(v) => setMunPrograma(v)}
            maxLength={1500}
          >
            <textarea spellCheck={true} 
              id="mun-programa"
              maxLength={1500} 
              rows={3} 
              value={munPrograma} 
              onChange={(e) => setMunPrograma(e.target.value)} 
              placeholder="Diligencie el nombre del programa" 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base resize-none mt-1" 
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{munPrograma.length} / 1500</p>
          </AIAssistedField>
        </div>
      </MgaAccordion>

      <MgaAccordion
        number="04"
        title="Instrumentos de Planeación de Grupos Étnicos"
        open={openAccordion === '04'}
        onToggle={() => handleToggle('04')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-base font-medium text-slate-700 mb-1">Tipo de comunidad</label>
            <select 
              value={etniasComunidad} 
              onChange={(e) => setEtniasComunidad(e.target.value)} 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base bg-white"
            >
              <option value="">Seleccione</option>
              <option value="Comunidades Afrocolombianas">Comunidades Afrocolombianas</option>
              <option value="Pueblos y comunidades indígenas">Pueblos y comunidades indígenas</option>
              <option value="Pueblos RROM o gitanos">Pueblos RROM o gitanos</option>
            </select>
          </div>
          <AIAssistedField
            label="Instrumentos de planeación de grupos étnicos"
            htmlFor="etnico-instrumentos"
            fieldHelpKey="instrumentos_etnicos"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={etniasInstrumentos}
            onAutoFill={(v) => setEtniasInstrumentos(v)}
            maxLength={500}
          >
            <textarea spellCheck={true} 
              id="etnico-instrumentos"
              maxLength={500} 
              rows={3} 
              value={etniasInstrumentos} 
              onChange={(e) => setEtniasInstrumentos(e.target.value)} 
              placeholder="Diligencie el nombre de los Instrumentos de planeación de grupos étnicos" 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base resize-none mt-1" 
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{etniasInstrumentos.length} / 500</p>
          </AIAssistedField>
        </div>
      </MgaAccordion>

      <div className="mt-8">
        <MgaActionButtons project={project} onSave={handleSave} />
      </div>

    </div>
  );
}
