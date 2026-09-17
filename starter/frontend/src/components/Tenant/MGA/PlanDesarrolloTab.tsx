import { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { type Project } from '../../../store/projectStore';
import { useProjectMgaStore, type PlanDesarrolloData, type PlanDesarrolloPndLink } from '../../../store/projectMgaStore';
import MgaAccordion from './MgaAccordion';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import type { ProjectContext } from '../../../data/mgaFieldsKnowledge';

export default function PlanDesarrolloTab({ project }: { project: Project }) {
  const [openAccordion, setOpenAccordion] = useState<string>('01');
  
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const savePlanDesarrollo = useProjectMgaStore((s) => s.savePlanDesarrollo);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const fieldProjectContext: ProjectContext = {
    projectName: project.name,
    sector: project.sector || undefined,
    productCode: project.product_code || undefined,
    procesoName: project.proceso_id ? String(project.proceso_id) : undefined,
    objeto: project.objeto || undefined,
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

  const handleToggle = (id: string) => {
    setOpenAccordion(openAccordion === id ? '' : id);
  };

  const handleSave = async () => {
    const data: PlanDesarrolloData = {
      pndLinks,
      departamental: { plan: depPlan, estrategia: depEstrategia, programa: depPrograma },
      municipal: { plan: munPlan, estrategia: munEstrategia, programa: munPrograma },
      etnico: { tipoComunidad: etnicoComunidad, instrumentos: etnicoInstrumentos },
      otros: { plan: otrosPlan, estrategia: otrosEstrategia, programa: otrosPrograma }
    };
    await savePlanDesarrollo(project.id, data);
  };

  const addPndLink = () => {
    setPndLinks([...pndLinks, { id: crypto.randomUUID(), transformacion: '', pilar: '', catalizador: '', componente: '' }]);
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
            <input 
              readOnly 
              type="text" 
              value={project.sector || ''} 
              className="w-full bg-slate-100 text-slate-700 border-slate-300 rounded px-3 py-2 text-base" 
            />
          </div>
          <div>
            <label className="block text-base font-medium text-slate-700 mb-1">Plan Nacional de Desarrollo</label>
            <input 
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
                        <input 
                          type="text" 
                          value={link.transformacion} 
                          onChange={(e) => updatePndLink(link.id, 'transformacion', e.target.value)} 
                          className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-2 py-1 text-sm" 
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input 
                          type="text" 
                          value={link.pilar} 
                          onChange={(e) => updatePndLink(link.id, 'pilar', e.target.value)} 
                          className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-2 py-1 text-sm" 
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input 
                          type="text" 
                          value={link.catalizador} 
                          onChange={(e) => updatePndLink(link.id, 'catalizador', e.target.value)} 
                          className="w-full border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 rounded px-2 py-1 text-sm" 
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input 
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
              onClick={addPndLink} 
              className="mt-3 inline-flex items-center gap-1 bg-blue-600 text-white font-medium hover:bg-blue-700 px-3 py-1.5 rounded-md text-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
        </div>
      </MgaAccordion>

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
            onAutoFill={(v) => setDepPlan(v)}
          >
            <textarea 
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
            onAutoFill={(v) => setDepEstrategia(v)}
          >
            <textarea 
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
            onAutoFill={(v) => setDepPrograma(v)}
          >
            <textarea 
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
            onAutoFill={(v) => setMunPlan(v)}
          >
            <textarea 
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
            onAutoFill={(v) => setMunEstrategia(v)}
          >
            <textarea 
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
            onAutoFill={(v) => setMunPrograma(v)}
          >
            <textarea 
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
            onAutoFill={(v) => setEtnicoInstrumentos(v)}
          >
            <textarea 
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
            onAutoFill={(v) => setOtrosPlan(v)}
          >
            <textarea 
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
            onAutoFill={(v) => setOtrosEstrategia(v)}
          >
            <textarea 
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
            onAutoFill={(v) => setOtrosPrograma(v)}
          >
            <textarea 
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

      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Guardar Plan de Desarrollo
        </button>
      </div>

    </div>
  );
}
