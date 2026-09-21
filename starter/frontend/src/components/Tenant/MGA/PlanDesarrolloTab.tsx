import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { type Project } from '../../../store/projectStore';
import { useProjectMgaStore, type PlanDesarrolloData, type PlanDesarrolloPndLink } from '../../../store/projectMgaStore';
import MgaAccordion from './MgaAccordion';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import PndSelectionModal from './PndSelectionModal';
import { type CatalogPnd } from '../../../store/catalogStore';
import type { ProjectContext } from '../../../data/mgaFieldsKnowledge';

export default function PlanDesarrolloTab({ project }: { project: Project }) {
  const [openAccordion, setOpenAccordion] = useState<string>('01');
  const [isPndModalOpen, setIsPndModalOpen] = useState(false);
  
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const savePlanDesarrollo = useProjectMgaStore((s) => s.savePlanDesarrollo);

  const fieldProjectContext: ProjectContext = {
    projectName: project.name,
    sector: project.sector || undefined,
    productCode: project.product_code || undefined,
    procesoName: (project as any)?.proceso_id ? String((project as any)?.proceso_id) : undefined,
    objeto: (project as any)?.objeto || undefined,
  };

  const [pndLinks, setPndLinks] = useState<PlanDesarrolloPndLink[]>([]);
  
  const [depPlan, setDepPlan] = useState('');
  const [depEstrategia, setDepEstrategia] = useState('');
  const [depPrograma, setDepPrograma] = useState('');

  const [munPlan, setMunPlan] = useState('');
  const [munEstrategia, setMunEstrategia] = useState('');
  const [munPrograma, setMunPrograma] = useState('');

  const [etnicoComunidad, setEtnicoComunidad] = useState('');
  const [etnicoInstrumentos, setEtnicoInstrumentos] = useState('');

  const [otrosPlan, setOtrosPlan] = useState('');
  const [otrosEstrategia, setOtrosEstrategia] = useState('');
  const [otrosPrograma, setOtrosPrograma] = useState('');

  useEffect(() => {
    if (formulation.planDesarrollo) {
      const data = formulation.planDesarrollo;
      setPndLinks(data.pndLinks || []);
      setDepPlan(data.departamental?.plan || '');
      setDepEstrategia(data.departamental?.estrategia || '');
      setDepPrograma(data.departamental?.programa || '');

      setMunPlan(data.municipal?.plan || '');
      setMunEstrategia(data.municipal?.estrategia || '');
      setMunPrograma(data.municipal?.programa || '');

      setEtnicoComunidad(data.etnico?.tipoComunidad || '');
      setEtnicoInstrumentos(data.etnico?.instrumentos || '');

      setOtrosPlan(data.otros?.plan || '');
      setOtrosEstrategia(data.otros?.estrategia || '');
      setOtrosPrograma(data.otros?.programa || '');
    }
  }, [formulation.planDesarrollo]);

  const reactiveContext = {
    depPlan, depEstrategia, depPrograma,
    munPlan, munEstrategia, munPrograma,
    etnicoComunidad, etnicoInstrumentos,
    otrosPlan, otrosEstrategia, otrosPrograma
  };

  const handleToggle = (id: string) => {
    setOpenAccordion(openAccordion === id ? '' : id);
  };

  useEffect(() => {
    const data: PlanDesarrolloData = {
      pndLinks,
      departamental: { plan: depPlan, estrategia: depEstrategia, programa: depPrograma },
      municipal: { plan: munPlan, estrategia: munEstrategia, programa: munPrograma },
      etnico: { tipoComunidad: etnicoComunidad, instrumentos: etnicoInstrumentos },
      otros: { plan: otrosPlan, estrategia: otrosEstrategia, programa: otrosPrograma }
    };
    savePlanDesarrollo(project.id, data);
  }, [
    pndLinks, depPlan, depEstrategia, depPrograma, 
    munPlan, munEstrategia, munPrograma, 
    etnicoComunidad, etnicoInstrumentos, 
    otrosPlan, otrosEstrategia, otrosPrograma, 
    project.id, savePlanDesarrollo
  ]);

  const addPndLink = (pnd: CatalogPnd) => {
    setPndLinks([...pndLinks, { 
      id: crypto.randomUUID(), 
      transformacion: pnd.PillarDescription, 
      pilar: pnd.ObjectiveDescription, 
      catalizador: pnd.StrategyDescription, 
      componente: pnd.ComponentDescription 
    }]);
    setIsPndModalOpen(false);
  };

  const updatePndLink = (id: string, field: keyof PlanDesarrolloPndLink, value: string) => {
    setPndLinks(pndLinks.map(link => link.id === id ? { ...link, [field]: value } : link));
  };

  const deletePndLink = (id: string) => {
    setPndLinks(pndLinks.filter(link => link.id !== id));
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
                  {pndLinks.map((link) => (
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
                  {pndLinks.length === 0 && (
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
            onAutoFill={(v) =
            maxLength={1500}> setDepPlan(v)}
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
            onAutoFill={(v) =
            maxLength={1500}> setDepEstrategia(v)}
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
            onAutoFill={(v) =
            maxLength={1500}> setDepPrograma(v)}
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
            onAutoFill={(v) =
            maxLength={1500}> setMunPlan(v)}
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
            onAutoFill={(v) =
            maxLength={1500}> setMunEstrategia(v)}
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
            onAutoFill={(v) =
            maxLength={1500}> setMunPrograma(v)}
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
              value={etnicoComunidad} 
              onChange={(e) => setEtnicoComunidad(e.target.value)} 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base bg-white"
            >
              <option value="">Seleccione</option>
              <option value="Indígena">Indígena</option>
              <option value="Afrocolombiana / Negra / Palenquera / Raizal">Afrocolombiana / Negra / Palenquera / Raizal</option>
              <option value="Rrom / Gitana">Rrom / Gitana</option>
              <option value="No aplica / Ninguna">No aplica / Ninguna</option>
            </select>
          </div>
          <AIAssistedField
            label="Instrumentos de planeación de grupos étnicos"
            htmlFor="etnico-instrumentos"
            fieldHelpKey="instrumentos_etnicos"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={etnicoInstrumentos}
            onAutoFill={(v) =
            maxLength={500}> setEtnicoInstrumentos(v)}
          >
            <textarea spellCheck={true} 
              id="etnico-instrumentos"
              maxLength={500} 
              rows={3} 
              value={etnicoInstrumentos} 
              onChange={(e) => setEtnicoInstrumentos(e.target.value)} 
              placeholder="Diligencie el nombre de los Instrumentos de planeación de grupos étnicos" 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base resize-none mt-1" 
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{etnicoInstrumentos.length} / 500</p>
          </AIAssistedField>
        </div>
      </MgaAccordion>

      <MgaAccordion
        number="05"
        title="Otros Instrumentos de Planeación"
        open={openAccordion === '05'}
        onToggle={() => handleToggle('05')}
      >
        <div className="space-y-4">
          <AIAssistedField
            label="Plan de Desarrollo"
            htmlFor="otros-plan"
            fieldHelpKey="plan_desarrollo"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={otrosPlan}
            onAutoFill={(v) =
            maxLength={1500}> setOtrosPlan(v)}
          >
            <textarea spellCheck={true} 
              id="otros-plan"
              maxLength={1500} 
              rows={3} 
              value={otrosPlan} 
              onChange={(e) => setOtrosPlan(e.target.value)} 
              placeholder="Diligencie el nombre del Plan de Desarrollo si el proyecto es registrado por una Localidad..." 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base resize-none mt-1" 
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{otrosPlan.length} / 1500</p>
          </AIAssistedField>
          <AIAssistedField
            label="Estrategia"
            htmlFor="otros-estrategia"
            fieldHelpKey="estrategia_desarrollo"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={otrosEstrategia}
            onAutoFill={(v) =
            maxLength={1500}> setOtrosEstrategia(v)}
          >
            <textarea spellCheck={true} 
              id="otros-estrategia"
              maxLength={1500} 
              rows={3} 
              value={otrosEstrategia} 
              onChange={(e) => setOtrosEstrategia(e.target.value)} 
              placeholder="Diligencie el nombre de la estrategia" 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base resize-none mt-1" 
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{otrosEstrategia.length} / 1500</p>
          </AIAssistedField>
          <AIAssistedField
            label="Programa"
            htmlFor="otros-programa"
            fieldHelpKey="programa_desarrollo"
            projectContext={fieldProjectContext}
            reactiveContext={reactiveContext}
            currentValue={otrosPrograma}
            onAutoFill={(v) =
            maxLength={1500}> setOtrosPrograma(v)}
          >
            <textarea spellCheck={true} 
              id="otros-programa"
              maxLength={1500} 
              rows={3} 
              value={otrosPrograma} 
              onChange={(e) => setOtrosPrograma(e.target.value)} 
              placeholder="Diligencie el nombre del programa" 
              className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-3 py-2 text-base resize-none mt-1" 
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{otrosPrograma.length} / 1500</p>
          </AIAssistedField>
        </div>
      </MgaAccordion>

    </div>
  );
}
