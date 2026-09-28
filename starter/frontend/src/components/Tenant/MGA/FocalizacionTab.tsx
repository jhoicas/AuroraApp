import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, MapPin, Edit3, PlusCircle, Trash2, X, Link, LogIn } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type PoliticaFocalizada, type PoliticaSinPoblacion } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';

// Dummy catalog for MVP
const MOCK_POLITICAS = [
  { id: 'pol-1', nombre: 'Víctimas del conflicto armado', subcategorias: [{ id: 'sub-1-1', nombre: 'Desplazados' }, { id: 'sub-1-2', nombre: 'Población infantil víctima' }] },
  { id: 'pol-2', nombre: 'Primera infancia', subcategorias: [{ id: 'sub-2-1', nombre: 'Cero a siempre' }] },
  { id: 'pol-3', nombre: 'Comunidades Étnicas', subcategorias: [{ id: 'sub-3-1', nombre: 'Indígenas' }, { id: 'sub-3-2', nombre: 'Afrocolombianos' }, { id: 'sub-3-3', nombre: 'Pueblo Rrom' }] },
  { id: 'pol-4', nombre: 'Población con discapacidad', subcategorias: [] },
  { id: 'pol-5', nombre: 'Otras Políticas', subcategorias: [{ id: 'sub-5-1', nombre: 'Deporte y Recreación' }, { id: 'sub-5-2', nombre: 'Cultura' }] }
];

const MOCK_CATEGORIAS = [
  { id: 'cat-1', nombre: 'Categoría A - Prevención' },
  { id: 'cat-2', nombre: 'Categoría B - Atención Integral' },
  { id: 'cat-3', nombre: 'Categoría C - Inclusión' },
];

const MOCK_INDICADORES = [
  { id: 'ind-1', nombre: 'Proporción de población atendida' },
  { id: 'ind-2', nombre: 'Tasa de cobertura efectiva' },
  { id: 'ind-3', nombre: 'Número de proyectos apoyados' },
];

export default function FocalizacionTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveProgramacion = useProjectMgaStore((s) => s.saveProgramacion);
  
  const alternativaSeleccionadaId = formulation.evaluacion?.alternativaSeleccionadaId;
  const cadenaValor = (formulation.cadenaValor as any)?.[alternativaSeleccionadaId as string] || { objetivos: [] };
  const programacion = formulation.programacion || {};
  const regionalizacion = programacion.regionalizacion || {};
  
  const locPrep = formulation.localizacionPreparacion?.[alternativaSeleccionadaId as string] || { ubicaciones: [] };
  const ubicaciones = locPrep.ubicaciones || [];
  const durationYears = 4; // Default
  
  const focalizacion = programacion.focalizacion || {};
  const polPoblacionales = focalizacion.politicasPoblacionales || {};
  const polConPob = focalizacion.politicasConPoblacion || {};
  const polSinPob = focalizacion.politicasSinPoblacion || [];
  const cruces = focalizacion.crucesPoliticas || {};

  const [localFoc, setLocalFoc] = useState({
    politicasPoblacionales: polPoblacionales,
    politicasConPoblacion: polConPob,
    politicasSinPoblacion: polSinPob,
    crucesPoliticas: cruces
  });
  
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    'acc-foc-1': true, 'acc-foc-2': true, 'acc-foc-3': true, 'acc-foc-4': true, 'acc-foc-5': true
  });
  
  // Modals state
  const [modalPobOpen, setModalPobOpen] = useState(false);
  const [modalPobKey, setModalPobKey] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [catId, setCatId] = useState('');
  const [subcatId, setSubcatId] = useState('');

  const [modalConPobOpen, setModalConPobOpen] = useState(false);
  const [activeCarac, setActiveCarac] = useState('');
  const [selCatCon, setSelCatCon] = useState('');
  const [selIndCon, setSelIndCon] = useState('');

  const [modalSinPobOpen, setModalSinPobOpen] = useState(false);
  const [selPolSin, setSelPolSin] = useState('');
  const [selCatSin, setSelCatSin] = useState('');
  const [selSubcatSin, setSelSubcatSin] = useState('');

  const [modalDistSinPobOpen, setModalDistSinPobOpen] = useState(false);
  const [activePolSinId, setActivePolSinId] = useState('');
  
  const [modalCruceOpen, setModalCruceOpen] = useState(false);
  const [activePolCruce, setActivePolCruce] = useState('');
  const [selCruces, setSelCruces] = useState<string[]>([]);

  const lastSavedRef = useRef<string>('');
  const isFirstMount = useRef(true);

  // Collect all products from cadena de valor for Acc 03 Matrix
  const allProducts: any[] = [];
  if (cadenaValor.objetivos && Array.isArray(cadenaValor.objetivos)) {
    cadenaValor.objetivos.forEach((obj: any) => {
      if (obj.productos && Array.isArray(obj.productos)) {
        obj.productos.forEach((prod: any) => {
          allProducts.push(prod);
        });
      }
    });
  }
  const [selectedProductId, setSelectedProductId] = useState<string>(allProducts[0]?.id || '');
  const [openRowsDist, setOpenRowsDist] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalFoc({
      politicasPoblacionales: polPoblacionales,
      politicasConPoblacion: polConPob,
      politicasSinPoblacion: polSinPob,
      crucesPoliticas: cruces
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(focalizacion)]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      lastSavedRef.current = JSON.stringify(localFoc);
      return;
    }
    const serialized = JSON.stringify(localFoc);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;
    
    const existing = useProjectMgaStore.getState().getFormulation(project.id).programacion || {};
    const merged = { ...existing, focalizacion: localFoc };
    void saveProgramacion(project.id, merged);
  }, [localFoc, project.id, saveProgramacion]);

  if (!alternativaSeleccionadaId) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
        <MgaAlert message="Debe seleccionar una alternativa ganadora en la pestaña de Evaluación antes de proceder." variant="error" />
      </div>
    );
  }

  const handleToggleAccordion = (id: string) => {
    setOpenAccordions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- ACORDEÓN 01: Matriz de Características ---
  const CARACTERISTICAS = ['Víctimas', 'Primera infancia', 'Discapacitados', 'Grupos Étnicos', 'Otros'];
  const matrizData: Record<string, Record<string, number>> = {};
  ubicaciones.forEach((loc: any) => {
    matrizData[loc.id] = {};
    CARACTERISTICAS.forEach(c => matrizData[loc.id][c] = 0);
  });

  ubicaciones.forEach((loc: any) => {
    let locTotalBen = 0;
    Object.values(regionalizacion).forEach(prodReg => {
      const pReg = prodReg.find(r => r.localizacionId === loc.id);
      if (pReg) {
        Object.values(pReg.distribucionPeriodos || {}).forEach(dp => {
          locTotalBen += (dp.beneficiarios || 0);
        });
      }
    });
    if (locTotalBen > 0) {
      matrizData[loc.id]['Víctimas'] = Math.floor(locTotalBen * 0.4);
      matrizData[loc.id]['Primera infancia'] = Math.floor(locTotalBen * 0.3);
      matrizData[loc.id]['Otros'] = locTotalBen - matrizData[loc.id]['Víctimas'] - matrizData[loc.id]['Primera infancia'];
    }
  });

  const totalesColumna: Record<string, number> = {};
  const caractsActivas: string[] = [];
  CARACTERISTICAS.forEach(c => {
    const total = ubicaciones.reduce((sum: number, loc: any) => sum + (matrizData[loc.id][c] || 0), 0);
    totalesColumna[c] = total;
    if (total > 0) caractsActivas.push(c);
  });

  // Acc 01 handlers
  const handleOpenPobModal = (locId: string, locName: string, charName: string, count: number) => {
    if (count <= 0) return;
    setModalPobKey(`${locId}_${charName}`);
    setModalTitle(`${charName} en ${locName} (${count} beneficiarios)`);
    setCatId(''); setSubcatId(''); setModalPobOpen(true);
  };
  const handleAddPolicyPob = () => {
    if (!modalPobKey || !catId) return;
    const pol = MOCK_POLITICAS.find(p => p.id === catId);
    if (!pol) return;
    const sub = pol.subcategorias.find(s => s.id === subcatId);
    const newItem: PoliticaFocalizada = {
      categoriaId: catId, categoriaNombre: pol.nombre,
      subcategoriaId: subcatId || undefined, subcategoriaNombre: sub?.nombre || undefined,
    };
    setLocalFoc(prev => ({
      ...prev, politicasPoblacionales: {
        ...prev.politicasPoblacionales,
        [modalPobKey]: [...(prev.politicasPoblacionales?.[modalPobKey] || []), newItem]
      }
    }));
    setCatId(''); setSubcatId('');
  };
  const handleRemovePolicyPob = (index: number) => {
    if (!modalPobKey) return;
    setLocalFoc(prev => ({
      ...prev, politicasPoblacionales: {
        ...prev.politicasPoblacionales,
        [modalPobKey]: (prev.politicasPoblacionales?.[modalPobKey] || []).filter((_, i) => i !== index)
      }
    }));
  };

  // Acc 02 handlers
  const handleOpenConPob = (c: string) => {
    setActiveCarac(c);
    const existing = localFoc.politicasConPoblacion?.[c];
    setSelCatCon(existing?.categoria || '');
    setSelIndCon(existing?.indicador || '');
    setModalConPobOpen(true);
  };
  const handleSaveConPob = () => {
    if (!selCatCon || !selIndCon) return;
    setLocalFoc(prev => ({
      ...prev,
      politicasConPoblacion: { ...prev.politicasConPoblacion, [activeCarac]: { categoria: selCatCon, indicador: selIndCon } }
    }));
    setModalConPobOpen(false);
  };

  // Acc 03 handlers
  const handleSaveSinPob = () => {
    if (!selPolSin || !selCatSin) return;
    const polName = MOCK_POLITICAS.find(p => p.id === selPolSin)?.nombre || selPolSin;
    const subName = MOCK_POLITICAS.find(p => p.id === selPolSin)?.subcategorias.find(s => s.id === selSubcatSin)?.nombre || '';
    
    const newPol: PoliticaSinPoblacion = { 
      id: crypto.randomUUID(), 
      politica: polName, 
      categoria: selCatSin, 
      subcategoria: subName || undefined,
      distribucion: {}
    };
    setLocalFoc(prev => ({
      ...prev,
      politicasSinPoblacion: [...(prev.politicasSinPoblacion || []), newPol]
    }));
    setModalSinPobOpen(false);
  };
  const handleRemoveSinPob = (id: string) => {
    setLocalFoc(prev => ({
      ...prev, politicasSinPoblacion: (prev.politicasSinPoblacion || []).filter(p => p.id !== id)
    }));
  };

  // Matrix handlers for Acc 03
  const handleToggleRowDist = (locId: string) => {
    setOpenRowsDist(prev => ({ ...prev, [locId]: !prev[locId] }));
  };

  const handleUpdateDist = (locId: string, periodo: number, field: 'costo' | 'meta', value: string) => {
    if (!selectedProductId || !activePolSinId) return;
    const numValue = Number(value) || 0;
    
    setLocalFoc(prev => {
      const pspIndex = (prev.politicasSinPoblacion || []).findIndex(p => p.id === activePolSinId);
      if (pspIndex === -1) return prev;
      
      const newPsp = [...(prev.politicasSinPoblacion || [])];
      const p = newPsp[pspIndex];
      
      const distribucion = { ...p.distribucion };
      const prodDist = { ...(distribucion[selectedProductId]?.localizaciones || {}) };
      const locDist = { ...(prodDist[locId]?.periodos || {}) };
      
      locDist[periodo] = {
        ...locDist[periodo],
        [field]: numValue
      };
      
      prodDist[locId] = { periodos: locDist };
      distribucion[selectedProductId] = { localizaciones: prodDist };
      
      newPsp[pspIndex] = { ...p, distribucion };
      
      return { ...prev, politicasSinPoblacion: newPsp };
    });
  };

  const selectedProduct = allProducts.find(p => p.id === selectedProductId);
  let totalCostoOriginal = 0;
  if (selectedProduct) {
    totalCostoOriginal = selectedProduct.actividades?.reduce((acc: number, act: any) => 
      acc + (act.costos?.reduce((sum: number, cost: any) => sum + (cost.valor || 0), 0) || 0), 0) || 0;
  }
  const totalMetaOriginal = selectedProduct?.cantidad || 0;

  let totalCostoDist = 0;
  let totalMetaDist = 0;
  
  if (activePolSinId && selectedProductId) {
    const activePolObj = localFoc.politicasSinPoblacion?.find(p => p.id === activePolSinId);
    if (activePolObj && activePolObj.distribucion[selectedProductId]) {
      const locs = activePolObj.distribucion[selectedProductId].localizaciones;
      Object.values(locs).forEach(locData => {
        Object.values(locData.periodos).forEach(per => {
          totalCostoDist += (per.costo || 0);
          totalMetaDist += (per.meta || 0);
        });
      });
    }
  }

  const pendienteCosto = totalCostoOriginal - totalCostoDist;
  const pendienteMeta = totalMetaOriginal - totalMetaDist;
  const isInvalidDist = pendienteCosto < 0 || pendienteMeta < 0;

  // Acc 04 handlers
  const allPolicies = [
    ...caractsActivas.map(c => ({ id: `con_${c}`, name: c })),
    ...(localFoc.politicasSinPoblacion || []).map(p => ({ id: p.id, name: p.politica }))
  ];

  const handleOpenCruce = (polId: string) => {
    setActivePolCruce(polId);
    setSelCruces(localFoc.crucesPoliticas?.[polId] || []);
    setModalCruceOpen(true);
  };
  const handleToggleCruce = (targetId: string) => {
    setSelCruces(prev => prev.includes(targetId) ? prev.filter(x => x !== targetId) : [...prev, targetId]);
  };
  const handleSaveCruce = () => {
    setLocalFoc(prev => ({
      ...prev, crucesPoliticas: { ...prev.crucesPoliticas, [activePolCruce]: selCruces }
    }));
    setModalCruceOpen(false);
  };

  const getPolicyName = (pid: string) => allPolicies.find(x => x.id === pid)?.name || pid;

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">03 - Focalización</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {/* ACORDEON 01 */}
      <div className="border rounded-lg overflow-hidden">
        <button onClick={() => handleToggleAccordion('acc-foc-1')} className="w-full flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left border-b font-semibold text-slate-700">
          {openAccordions['acc-foc-1'] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          01 - Resumen de la población con características poblacionales
        </button>
        {openAccordions['acc-foc-1'] && (
          <div className="p-4 bg-white overflow-x-auto">
            <table className="w-full text-left text-sm border">
              <thead className="bg-slate-100 text-slate-700 border-b">
                <tr>
                  <th className="p-3 border-r font-semibold">Ubicación (Región / Depto / Mun)</th>
                  {CARACTERISTICAS.map(c => <th key={c} className="p-3 border-r font-semibold text-center">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {ubicaciones.map((loc: any) => {
                  const locName = `${loc.region} ${loc.departamento ? `> ${loc.departamento}` : ''} ${loc.municipio ? `> ${loc.municipio}` : ''}`;
                  return (
                    <tr key={loc.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="p-3 border-r flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /><span className="font-medium text-slate-700">{locName}</span></td>
                      {CARACTERISTICAS.map(c => {
                        const val = matrizData[loc.id][c] || 0;
                        return (
                          <td key={c} className="p-3 border-r text-center">
                            {val > 0 ? (
                              <button onClick={() => handleOpenPobModal(loc.id, locName, c, val)} className="text-[#2980b9] hover:text-[#1a6698] font-semibold flex items-center justify-center gap-1 mx-auto">
                                {val} <Edit3 className="w-3 h-3" />
                              </button>
                            ) : <span className="text-slate-400">{val}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="bg-slate-100 font-bold border-t-2">
                  <td className="p-3 border-r text-right">TOTAL CARACTERÍSTICA</td>
                  {CARACTERISTICAS.map(c => <td key={c} className="p-3 border-r text-center text-emerald-700">{totalesColumna[c]}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ACORDEON 02 */}
      <div className="border rounded-lg overflow-hidden">
        <button onClick={() => handleToggleAccordion('acc-foc-2')} className="w-full flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left border-b font-semibold text-slate-700">
          {openAccordions['acc-foc-2'] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          02 - Políticas con población
        </button>
        {openAccordions['acc-foc-2'] && (
          <div className="p-4 bg-white">
            <table className="w-full text-left text-sm border">
              <thead className="bg-slate-100 text-slate-700 border-b">
                <tr><th className="p-3 border-r">Política</th><th className="p-3 border-r">Categoría</th><th className="p-3 border-r">Indicador</th><th className="p-3 text-center">Acción</th></tr>
              </thead>
              <tbody>
                {caractsActivas.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-slate-500">No hay políticas poblacionales activas.</td></tr> :
                  caractsActivas.map(c => {
                    const saved = localFoc.politicasConPoblacion?.[c];
                    return (
                      <tr key={c} className="border-b hover:bg-slate-50">
                        <td className="p-3 border-r font-medium text-slate-700">{c}</td>
                        <td className="p-3 border-r text-slate-600">{saved?.categoria || '---'}</td>
                        <td className="p-3 border-r text-slate-600">{saved?.indicador || '---'}</td>
                        <td className="p-3 text-center">
                          <button onClick={() => handleOpenConPob(c)} className="text-[#2980b9] hover:bg-blue-50 p-1.5 rounded flex items-center justify-center gap-1 mx-auto">
                            <Edit3 className="w-4 h-4" /> Ingresar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ACORDEON 03 */}
      <div className="border rounded-lg overflow-hidden">
        <button onClick={() => handleToggleAccordion('acc-foc-3')} className="w-full flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left border-b font-semibold text-slate-700">
          {openAccordions['acc-foc-3'] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          03 - Políticas sin población
        </button>
        {openAccordions['acc-foc-3'] && (
          <div className="p-4 bg-white space-y-4">
            <table className="w-full text-left text-sm border">
              <thead className="bg-slate-100 text-slate-700 border-b">
                <tr><th className="p-3 border-r">Política</th><th className="p-3 border-r">Categoría</th><th className="p-3 border-r">Subcategoría</th><th className="p-3 text-center w-24">Distribución</th><th className="p-3 text-center w-20">Acción</th></tr>
              </thead>
              <tbody>
                {(localFoc.politicasSinPoblacion || []).length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-slate-500">No hay políticas sin población adicionadas.</td></tr> :
                  (localFoc.politicasSinPoblacion || []).map(p => (
                    <tr key={p.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 border-r font-medium text-slate-700">{p.politica}</td>
                      <td className="p-3 border-r text-slate-600">{p.categoria}</td>
                      <td className="p-3 border-r text-slate-600">{p.subcategoria || '---'}</td>
                      <td className="p-3 border-r text-center">
                        <button onClick={() => { setActivePolSinId(p.id); setModalDistSinPobOpen(true); }} className="text-[#2980b9] hover:bg-blue-50 px-3 py-1.5 rounded flex items-center justify-center gap-1 mx-auto font-medium">
                          Ingresar <LogIn className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleRemoveSinPob(p.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded mx-auto"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
            <button onClick={() => { setSelPolSin(''); setSelCatSin(''); setSelSubcatSin(''); setModalSinPobOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-[#2980b9] text-white rounded-lg hover:bg-[#1a6698]">
              <PlusCircle className="w-4 h-4" /> Adicionar Política
            </button>
          </div>
        )}
      </div>

      {/* ACORDEON 04 */}
      <div className="border rounded-lg overflow-hidden">
        <button onClick={() => handleToggleAccordion('acc-foc-4')} className="w-full flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left border-b font-semibold text-slate-700">
          {openAccordions['acc-foc-4'] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          04 - Cruce de Políticas
        </button>
        {openAccordions['acc-foc-4'] && (
          <div className="p-4 bg-white">
            <table className="w-full text-left text-sm border">
              <thead className="bg-slate-100 text-slate-700 border-b">
                <tr><th className="p-3 border-r">Política</th><th className="p-3 border-r">Cruce políticas</th><th className="p-3 text-center">Acción</th></tr>
              </thead>
              <tbody>
                {allPolicies.length === 0 ? <tr><td colSpan={3} className="p-4 text-center text-slate-500">No hay políticas disponibles para cruzar.</td></tr> :
                  allPolicies.map(pol => {
                    const crucesDePol = (localFoc.crucesPoliticas?.[pol.id] || []).map(getPolicyName).join(', ');
                    return (
                      <tr key={pol.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 border-r font-medium text-slate-700">{pol.name}</td>
                        <td className="p-3 border-r text-slate-600">{crucesDePol || 'Ninguno'}</td>
                        <td className="p-3 text-center">
                          <button onClick={() => handleOpenCruce(pol.id)} className="text-[#2980b9] hover:bg-blue-50 p-1.5 rounded flex items-center justify-center gap-1 mx-auto">
                            <Link className="w-4 h-4" /> Ingresar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ACORDEON 05 */}
      <div className="border rounded-lg overflow-hidden">
        <button onClick={() => handleToggleAccordion('acc-foc-5')} className="w-full flex items-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left border-b font-semibold text-slate-700">
          {openAccordions['acc-foc-5'] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          05 - Resumen Focalización
        </button>
        {openAccordions['acc-foc-5'] && (
          <div className="p-4 bg-white">
            <table className="w-full text-left text-sm border">
              <thead className="bg-slate-100 text-slate-700 border-b">
                <tr><th className="p-3 border-r">Política</th><th className="p-3 border-r">Categoría</th><th className="p-3 border-r">Cruces de políticas</th></tr>
              </thead>
              <tbody>
                {allPolicies.length === 0 ? <tr><td colSpan={3} className="p-4 text-center text-slate-500">No hay información de focalización para resumir.</td></tr> :
                  allPolicies.map(pol => {
                    let cat = '---';
                    if (pol.id.startsWith('con_')) {
                      const base = pol.id.replace('con_', '');
                      cat = localFoc.politicasConPoblacion?.[base]?.categoria || '---';
                    } else {
                      const sin = (localFoc.politicasSinPoblacion || []).find(p => p.id === pol.id);
                      if (sin) { cat = sin.categoria; }
                    }
                    const crucesStr = (localFoc.crucesPoliticas?.[pol.id] || []).map(getPolicyName).join(', ');
                    return (
                      <tr key={pol.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 border-r font-medium text-slate-700">{pol.name}</td>
                        <td className="p-3 border-r text-slate-600">{cat}</td>
                        <td className="p-3 border-r text-slate-600">{crucesStr || '---'}</td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* MODAL 01: Poblacion */}
      {modalPobOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Focalización: {modalTitle}</h2>
              <button onClick={() => setModalPobOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Política Pública</label>
                  <select value={catId} onChange={(e) => { setCatId(e.target.value); setSubcatId(''); }} className="w-full p-2 border rounded-lg outline-none focus:border-[#2980b9] bg-white">
                    <option value="">Seleccione...</option>{MOCK_POLITICAS.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategoría (Opcional)</label>
                  <select value={subcatId} onChange={(e) => setSubcatId(e.target.value)} disabled={!catId} className="w-full p-2 border rounded-lg outline-none focus:border-[#2980b9] bg-white disabled:bg-slate-100">
                    <option value="">Seleccione...</option>{MOCK_POLITICAS.find(p => p.id === catId)?.subcategorias.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end"><button onClick={handleAddPolicyPob} disabled={!catId} className="px-4 py-2 bg-[#2980b9] text-white rounded-lg hover:bg-[#1a6698]">Adicionar</button></div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Políticas Agregadas</h3>
                <table className="w-full text-left text-sm border"><thead className="bg-slate-100"><tr><th className="p-2">Política</th><th className="p-2">Subcategoría</th><th className="p-2 text-center">Acción</th></tr></thead>
                  <tbody>
                    {(localFoc.politicasPoblacionales?.[modalPobKey!] || []).map((item, idx) => (
                      <tr key={idx} className="border-b"><td className="p-2">{item.categoriaNombre}</td><td className="p-2">{item.subcategoriaNombre || 'N/A'}</td><td className="p-2 text-center"><button onClick={() => handleRemovePolicyPob(idx)} className="text-red-500"><Trash2 className="w-4 h-4" /></button></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end"><button onClick={() => setModalPobOpen(false)} className="px-4 py-2 bg-[#2980b9] text-white rounded">Aceptar</button></div>
          </div>
        </div>
      )}

      {/* MODAL 02: Con Poblacion */}
      {modalConPobOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Categoría e Indicador para {activeCarac}</h2>
              <button onClick={() => setModalConPobOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría</label>
                <select value={selCatCon} onChange={(e) => setSelCatCon(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                  <option value="">Seleccione...</option>{MOCK_CATEGORIAS.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Indicador</label>
                <select value={selIndCon} onChange={(e) => setSelIndCon(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                  <option value="">Seleccione...</option>{MOCK_INDICADORES.map(i => <option key={i.nombre} value={i.nombre}>{i.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setModalConPobOpen(false)} className="px-4 py-2 bg-white border text-slate-600 rounded">Cancelar</button>
              <button onClick={handleSaveConPob} disabled={!selCatCon || !selIndCon} className="px-4 py-2 bg-[#2980b9] text-white rounded">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 03: Sin Poblacion (Adicionar) */}
      {modalSinPobOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Adicionar Política Sin Población</h2>
              <button onClick={() => setModalSinPobOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Política</label>
                <select value={selPolSin} onChange={(e) => { setSelPolSin(e.target.value); setSelSubcatSin(''); }} className="w-full p-2 border rounded-lg bg-white">
                  <option value="">Seleccione...</option>{MOCK_POLITICAS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría</label>
                <select value={selCatSin} onChange={(e) => setSelCatSin(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                  <option value="">Seleccione...</option>{MOCK_CATEGORIAS.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategoría (Opcional)</label>
                <select value={selSubcatSin} onChange={(e) => setSelSubcatSin(e.target.value)} disabled={!selPolSin} className="w-full p-2 border rounded-lg bg-white disabled:bg-slate-100">
                  <option value="">Seleccione...</option>{MOCK_POLITICAS.find(p => p.id === selPolSin)?.subcategorias.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setModalSinPobOpen(false)} className="px-4 py-2 bg-white border text-slate-600 rounded">Cancelar</button>
              <button onClick={handleSaveSinPob} disabled={!selPolSin || !selCatSin} className="px-4 py-2 bg-[#2980b9] text-white rounded">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 03: Matriz de Distribución (Ingresar) */}
      {modalDistSinPobOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50 shrink-0">
              <h2 className="text-lg font-semibold text-slate-800">
                Distribución de Política: {localFoc.politicasSinPoblacion?.find(p => p.id === activePolSinId)?.politica}
              </h2>
              <button onClick={() => setModalDistSinPobOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-white">
              {allProducts.length === 0 ? (
                <MgaAlert message="No hay productos definidos en la Cadena de Valor." variant="warning" />
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Producto a distribuir:</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-[#2980b9] bg-white text-sm font-medium"
                    >
                      {allProducts.map(prod => (
                        <option key={prod.id} value={prod.id}>{prod.descripcion} (Meta: {prod.cantidad})</option>
                      ))}
                    </select>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-700 border-b">
                        <tr>
                          <th className="p-3 w-10"></th>
                          <th className="p-3">Ubicación (Región / Departamento / Municipio)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ubicaciones.length === 0 ? (
                          <tr><td colSpan={2} className="p-4 text-center text-slate-500">No hay localizaciones.</td></tr>
                        ) : (
                          ubicaciones.map((loc: any) => {
                            const isOpen = openRowsDist[loc.id];
                            const distObj = localFoc.politicasSinPoblacion?.find(p => p.id === activePolSinId)?.distribucion?.[selectedProductId]?.localizaciones?.[loc.id]?.periodos || {};
                            
                            return (
                              <React.Fragment key={loc.id}>
                                <tr className="border-b hover:bg-slate-50 transition-colors">
                                  <td className="p-2 text-center">
                                    <button onClick={() => handleToggleRowDist(loc.id)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="w-4 h-4 text-slate-400" />
                                      <span className="font-medium text-slate-700">
                                        {loc.region} {loc.departamento ? `> ${loc.departamento}` : ''} {loc.municipio ? `> ${loc.municipio}` : ''}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                                {isOpen && (
                                  <tr className="bg-slate-50/50 border-b">
                                    <td colSpan={2} className="p-4">
                                      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-sm">
                                          <thead className="bg-slate-100 text-slate-600 border-b">
                                            <tr>
                                              <th className="p-2 font-semibold w-24">Periodo</th>
                                              <th className="p-2 font-semibold text-right">Costos categoría</th>
                                              <th className="p-2 font-semibold text-right">Meta categoría</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {Array.from({ length: durationYears + 1 }).map((_, i) => (
                                              <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                                <td className="p-2 font-medium text-slate-600 pl-4">Año {i}</td>
                                                <td className="p-2">
                                                  <input
                                                    type="number" min="0" step="any"
                                                    value={distObj[i]?.costo || ''}
                                                    onChange={(e) => handleUpdateDist(loc.id, i, 'costo', e.target.value)}
                                                    className="w-full p-1.5 border rounded text-right bg-white focus:border-[#2980b9] outline-none"
                                                    placeholder="0"
                                                  />
                                                </td>
                                                <td className="p-2">
                                                  <input
                                                    type="number" min="0" step="any"
                                                    value={distObj[i]?.meta || ''}
                                                    onChange={(e) => handleUpdateDist(loc.id, i, 'meta', e.target.value)}
                                                    className="w-full p-1.5 border rounded text-right bg-white focus:border-[#2980b9] outline-none"
                                                    placeholder="0"
                                                  />
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <p className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b">Total Costo</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Costo del producto:</span><span className="font-medium text-slate-800">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalCostoOriginal)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Total distribuido:</span><span className="font-medium text-blue-600">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalCostoDist)}</span></div>
                        <div className="flex justify-between pt-2 border-t"><span className="font-semibold text-slate-700">Pendiente:</span>
                          <span className={`font-bold ${pendienteCosto < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(pendienteCosto)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <p className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b">Total Meta</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Meta del producto:</span><span className="font-medium text-slate-800">{totalMetaOriginal}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Total distribuida:</span><span className="font-medium text-emerald-600">{totalMetaDist}</span></div>
                        <div className="flex justify-between pt-2 border-t"><span className="font-semibold text-slate-700">Pendiente:</span>
                          <span className={`font-bold ${pendienteMeta < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                            {pendienteMeta}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3 shrink-0">
              {isInvalidDist && <span className="text-red-500 text-sm font-medium self-center mr-4">El saldo pendiente no puede ser negativo.</span>}
              <button onClick={() => setModalDistSinPobOpen(false)} disabled={isInvalidDist} className="px-6 py-2 bg-[#2980b9] text-white rounded hover:bg-[#1a6698] font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 04: Cruce de Politicas */}
      {modalCruceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Cruce de Políticas</h2>
              <button onClick={() => setModalCruceOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">Seleccione las políticas con las que desea cruzar: <strong>{getPolicyName(activePolCruce)}</strong></p>
              <div className="space-y-2 max-h-60 overflow-y-auto p-2 border rounded bg-slate-50">
                {allPolicies.filter(p => p.id !== activePolCruce).length === 0 ? <p className="text-slate-500 text-sm">No hay otras políticas disponibles.</p> :
                  allPolicies.filter(p => p.id !== activePolCruce).map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={selCruces.includes(p.id)} onChange={() => handleToggleCruce(p.id)} className="rounded text-[#2980b9] focus:ring-[#2980b9]" />
                      {p.name}
                    </label>
                  ))
                }
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setModalCruceOpen(false)} className="px-4 py-2 bg-white border text-slate-600 rounded">Cancelar</button>
              <button onClick={handleSaveCruce} className="px-4 py-2 bg-[#2980b9] text-white rounded">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
