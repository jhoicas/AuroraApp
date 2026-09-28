import { useState, useEffect, useRef } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, MapPin, Edit3, PlusCircle, Trash2, X } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type PoliticaFocalizada } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';

// Dummy catalog for MVP
const MOCK_POLITICAS = [
  {
    id: 'pol-1',
    nombre: 'Víctimas del conflicto armado',
    subcategorias: [
      { id: 'sub-1-1', nombre: 'Desplazados' },
      { id: 'sub-1-2', nombre: 'Población infantil víctima' }
    ]
  },
  {
    id: 'pol-2',
    nombre: 'Primera infancia',
    subcategorias: [
      { id: 'sub-2-1', nombre: 'Cero a siempre' }
    ]
  },
  {
    id: 'pol-3',
    nombre: 'Comunidades Étnicas',
    subcategorias: [
      { id: 'sub-3-1', nombre: 'Indígenas' },
      { id: 'sub-3-2', nombre: 'Afrocolombianos' },
      { id: 'sub-3-3', nombre: 'Pueblo Rrom' }
    ]
  },
  {
    id: 'pol-4',
    nombre: 'Población con discapacidad',
    subcategorias: []
  }
];

export default function FocalizacionTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveProgramacion = useProjectMgaStore((s) => s.saveProgramacion);
  
  const alternativaSeleccionadaId = formulation.evaluacion?.alternativaSeleccionadaId;
  const programacion = formulation.programacion || {};
  const regionalizacion = programacion.regionalizacion || {};
  
  const locPrep = formulation.localizacionPreparacion?.[alternativaSeleccionadaId as string] || { ubicaciones: [] };
  const ubicaciones = locPrep.ubicaciones || [];
  
  const focalizacion = programacion.focalizacion?.politicasPoblacionales || {};
  
  const [localFoc, setLocalFoc] = useState<Record<string, PoliticaFocalizada[]>>(focalizacion);
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({ 'acc-foc-1': true });
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState<string | null>(null); // "localizacionId_caracteristicaNombre"
  const [modalTitle, setModalTitle] = useState('');
  
  const [catId, setCatId] = useState('');
  const [subcatId, setSubcatId] = useState('');

  const lastSavedRef = useRef<string>('');
  const isFirstMount = useRef(true);

  // Sync state initially
  useEffect(() => {
    setLocalFoc(focalizacion);
  }, [JSON.stringify(focalizacion)]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      lastSavedRef.current = JSON.stringify({ politicasPoblacionales: localFoc });
      return;
    }
    const serialized = JSON.stringify({ politicasPoblacionales: localFoc });
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;
    
    const existing = useProjectMgaStore.getState().getFormulation(project.id).programacion || {};
    const merged = { 
      ...existing, 
      focalizacion: { 
        ...existing.focalizacion, 
        politicasPoblacionales: localFoc 
      } 
    };
    void saveProgramacion(project.id, merged);
  }, [localFoc, project.id, saveProgramacion]);

  if (!alternativaSeleccionadaId) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
        <MgaAlert 
          message="Debe seleccionar una alternativa ganadora en la pestaña de Evaluación antes de proceder." 
          variant="error" 
        />
      </div>
    );
  }

  const handleToggleAccordion = (id: string) => {
    setOpenAccordions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Derive population characteristics (just a simple mapping from regionalization for MVP)
  // In a real scenario, this would come from the exact characteristic chosen in Preparacion/Localizacion.
  // We'll mock "Víctimas" and "Primera infancia" as generic columns.
  const CARACTERISTICAS = ['Víctimas', 'Primera infancia', 'Discapacitados', 'Grupos Étnicos', 'Otros'];

  // Calculate sum of beneficiaries per location per characteristic
  const matrizData: Record<string, Record<string, number>> = {};
  
  ubicaciones.forEach((loc: any) => {
    matrizData[loc.id] = {};
    CARACTERISTICAS.forEach(c => matrizData[loc.id][c] = 0);
  });

  // Just to give it some data, we sum all beneficiarios across all products for that location
  // and distribute it evenly across the mock characteristics just to show the UI,
  // since the actual characteristics are not defined in the regionalization data struct we made.
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
    
    // Fake distribution for demo purposes
    if (locTotalBen > 0) {
      matrizData[loc.id]['Víctimas'] = Math.floor(locTotalBen * 0.4);
      matrizData[loc.id]['Primera infancia'] = Math.floor(locTotalBen * 0.3);
      matrizData[loc.id]['Otros'] = locTotalBen - matrizData[loc.id]['Víctimas'] - matrizData[loc.id]['Primera infancia'];
    }
  });

  const totalesColumna: Record<string, number> = {};
  CARACTERISTICAS.forEach(c => {
    totalesColumna[c] = ubicaciones.reduce((sum: number, loc: any) => sum + (matrizData[loc.id][c] || 0), 0);
  });

  const handleOpenModal = (locId: string, locName: string, charName: string, count: number) => {
    if (count <= 0) return;
    setModalKey(`${locId}_${charName}`);
    setModalTitle(`${charName} en ${locName} (${count} beneficiarios)`);
    setCatId('');
    setSubcatId('');
    setModalOpen(true);
  };

  const handleAddPolicy = () => {
    if (!modalKey || !catId) return;
    const pol = MOCK_POLITICAS.find(p => p.id === catId);
    if (!pol) return;
    
    let subNombre = '';
    if (subcatId) {
      const sub = pol.subcategorias.find(s => s.id === subcatId);
      if (sub) subNombre = sub.nombre;
    }
    
    const newItem: PoliticaFocalizada = {
      categoriaId: catId,
      categoriaNombre: pol.nombre,
      subcategoriaId: subcatId || undefined,
      subcategoriaNombre: subNombre || undefined,
    };
    
    setLocalFoc(prev => {
      const arr = prev[modalKey] || [];
      return { ...prev, [modalKey]: [...arr, newItem] };
    });
    
    setCatId('');
    setSubcatId('');
  };

  const handleRemovePolicy = (index: number) => {
    if (!modalKey) return;
    setLocalFoc(prev => {
      const arr = prev[modalKey] || [];
      return { ...prev, [modalKey]: arr.filter((_, i) => i !== index) };
    });
  };

  const activePol = MOCK_POLITICAS.find(p => p.id === catId);
  const currentModalList = modalKey ? (localFoc[modalKey] || []) : [];

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">03 - Focalización</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => handleToggleAccordion('acc-foc-1')}
          className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left border-b"
        >
          <div className="flex items-center gap-2">
            {openAccordions['acc-foc-1'] ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
            <span className="font-semibold text-slate-700">Resumen de la población con características poblacionales</span>
          </div>
        </button>

        {openAccordions['acc-foc-1'] && (
          <div className="p-4 bg-white overflow-x-auto">
            <table className="w-full text-left text-sm border">
              <thead className="bg-slate-100 text-slate-700 border-b">
                <tr>
                  <th className="p-3 border-r font-semibold">Ubicación (Región / Depto / Mun)</th>
                  {CARACTERISTICAS.map(c => (
                    <th key={c} className="p-3 border-r font-semibold text-center">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ubicaciones.length === 0 ? (
                  <tr>
                    <td colSpan={CARACTERISTICAS.length + 1} className="p-4 text-center text-slate-500">
                      No hay localizaciones definidas para esta alternativa.
                    </td>
                  </tr>
                ) : (
                  ubicaciones.map((loc: any) => {
                    const locName = `${loc.region} ${loc.departamento ? `> ${loc.departamento}` : ''} ${loc.municipio ? `> ${loc.municipio}` : ''}`;
                    return (
                      <tr key={loc.id} className="border-b hover:bg-slate-50 transition-colors">
                        <td className="p-3 border-r">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-700">{locName}</span>
                          </div>
                        </td>
                        {CARACTERISTICAS.map(c => {
                          const val = matrizData[loc.id][c] || 0;
                          return (
                            <td key={c} className="p-3 border-r text-center">
                              {val > 0 ? (
                                <button
                                  onClick={() => handleOpenModal(loc.id, locName, c, val)}
                                  className="text-[#2980b9] hover:text-[#1a6698] hover:underline font-semibold flex items-center justify-center gap-1 mx-auto"
                                >
                                  {val}
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className="text-slate-400">{val}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
                {ubicaciones.length > 0 && (
                  <tr className="bg-slate-100 font-bold border-t-2">
                    <td className="p-3 border-r text-right">TOTAL CARACTERÍSTICA</td>
                    {CARACTERISTICAS.map(c => (
                      <td key={c} className="p-3 border-r text-center text-emerald-700">
                        {totalesColumna[c]}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">
                Focalización de Políticas: {modalTitle}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Política Pública <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={catId}
                    onChange={(e) => { setCatId(e.target.value); setSubcatId(''); }}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-[#2980b9] bg-white text-sm"
                  >
                    <option value="">Seleccione...</option>
                    {MOCK_POLITICAS.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subcategoría (Opcional)
                  </label>
                  <select
                    value={subcatId}
                    onChange={(e) => setSubcatId(e.target.value)}
                    disabled={!activePol || activePol.subcategorias.length === 0}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-[#2980b9] bg-white text-sm disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">Seleccione...</option>
                    {activePol?.subcategorias.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={handleAddPolicy}
                  disabled={!catId}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2980b9] text-white rounded-lg hover:bg-[#1a6698] transition-colors disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  Adicionar Política
                </button>
              </div>
              
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Políticas Agregadas</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600 border-b">
                      <tr>
                        <th className="p-2 w-10 text-center">N°</th>
                        <th className="p-2">Política Poblacional</th>
                        <th className="p-2">Subcategoría</th>
                        <th className="p-2 w-16 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentModalList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-500 border-b">
                            No hay políticas focalizadas para esta población.
                          </td>
                        </tr>
                      ) : (
                        currentModalList.map((item, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                            <td className="p-2 font-medium">{item.categoriaNombre}</td>
                            <td className="p-2 text-slate-600">{item.subcategoriaNombre || 'N/A'}</td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleRemovePolicy(idx)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setModalOpen(false)} 
                className="px-4 py-2 bg-[#2980b9] text-white rounded hover:bg-[#1a6698] font-medium"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
