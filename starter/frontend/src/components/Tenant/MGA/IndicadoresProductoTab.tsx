import { useState, useEffect, useRef } from 'react';
import { HelpCircle, PlusCircle, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type IndicadorProductoProgramado, type ProductoCvJson } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import { CountedTextarea } from '../../ui/CountedTextarea';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

export default function IndicadoresProductoTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveProgramacion = useProjectMgaStore((s) => s.saveProgramacion);
  
  const [error, setError] = useState<string | null>(null);
  
  const alternativaSeleccionadaId = formulation.evaluacion?.alternativaSeleccionadaId;
  const cadenaValor = (formulation.cadenaValor as any)?.[alternativaSeleccionadaId as string] || { objetivos: [] };
  
  const programacion = formulation.programacion || {};
  const indicadoresProgramados = programacion.indicadoresProducto || {};

  const lastSavedRef = useRef<string>('');
  const isFirstMount = useRef(true);
  
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      lastSavedRef.current = JSON.stringify({ indicadoresProducto: indicadoresProgramados });
      return;
    }
    const serialized = JSON.stringify({ indicadoresProducto: indicadoresProgramados });
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;
    
    const existing = useProjectMgaStore.getState().getFormulation(project.id).programacion || {};
    const merged = { ...existing, indicadoresProducto: indicadoresProgramados };
    void saveProgramacion(project.id, merged);
  }, [indicadoresProgramados, project.id, saveProgramacion]);

  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
  
  const toggleAccordion = (id: string) => {
    setOpenAccordions((prev: Record<string, boolean>) => ({ ...prev, [id]: !prev[id] }));
  };

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [wizardProductId, setWizardProductId] = useState<string | null>(null);
  const [wizardProduct, setWizardProduct] = useState<ProductoCvJson | null>(null);
  
  // Wizard state
  const [wIndicator, setWIndicator] = useState<{ id: string, nombre: string }>({ id: '', nombre: '' });
  const [wEsPrincipal, setWEsPrincipal] = useState(false);
  const [wEsAcumulativo, setWEsAcumulativo] = useState(true);
  const [wFuente, setWFuente] = useState('');
  const [wDetalle, setWDetalle] = useState('');
  const [wMetas, setWMetas] = useState<Record<number, number>>({});

  const durationYears = 4; // Default to 4 years if not available on project

  const handleOpenWizard = (productId: string, product: ProductoCvJson) => {
    setWizardProductId(productId);
    setWizardProduct(product);
    setWizardStep(1);
    setWIndicator({ id: '', nombre: '' });
    setWEsPrincipal((indicadoresProgramados[productId] || []).length === 0);
    setWEsAcumulativo(true);
    setWFuente('');
    setWDetalle('');
    const defaultMetas: Record<number, number> = {};
    for (let i = 0; i <= durationYears; i++) defaultMetas[i] = 0;
    setWMetas(defaultMetas);
    setWizardOpen(true);
  };

  const handleNextStep = () => {
    if (wizardStep === 1) {
      if (!wIndicator.id || !wFuente || !wDetalle) {
        setError("Todos los campos marcados con * son obligatorios.");
        return;
      }
      setError(null);
      setWizardStep(2);
    } else {
      handleSaveIndicator();
    }
  };

  const handleSaveIndicator = () => {
    if (!wizardProduct || !wizardProductId) return;
    
    // Validate metas
    const sum = Object.values(wMetas).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
    const metaTotal = wizardProduct.cantidad || 0;
    
    if (wEsAcumulativo) {
      if (sum > metaTotal) {
        setError(`La sumatoria de metas (${sum}) no puede superar la meta total del producto (${metaTotal}).`);
        return;
      }
    } else {
      const hasExactMatch = Object.values(wMetas).some(v => Number(v) === metaTotal);
      if (!hasExactMatch) {
        setError(`Como no es acumulativo, al menos un periodo debe tener el valor exacto de la meta total (${metaTotal}).`);
        return;
      }
    }
    
    const newIndicator: IndicadorProductoProgramado = {
      id: crypto.randomUUID(),
      indicadorId: wIndicator.id,
      nombre: wIndicator.nombre,
      esPrincipal: wEsPrincipal,
      esAcumulativo: wEsAcumulativo,
      fuenteVerificacion: wFuente,
      detalleFuente: wDetalle,
      metasPeriodo: wMetas
    };
    
    const prevProds = indicadoresProgramados[wizardProductId] || [];
    
    const updated = {
      ...indicadoresProgramados,
      [wizardProductId]: [...prevProds, newIndicator]
    };
    
    // We update local state which triggers useEffect
    const existing = useProjectMgaStore.getState().getFormulation(project.id).programacion || {};
    void saveProgramacion(project.id, { ...existing, indicadoresProducto: updated });
    
    setWizardOpen(false);
    setError(null);
  };
  
  const handleDeleteIndicator = (productId: string, indicatorId: string) => {
    const prevProds = indicadoresProgramados[productId] || [];
    const updated = {
      ...indicadoresProgramados,
      [productId]: prevProds.filter(i => i.id !== indicatorId)
    };
    const existing = useProjectMgaStore.getState().getFormulation(project.id).programacion || {};
    void saveProgramacion(project.id, { ...existing, indicadoresProducto: updated });
  };

  if (!alternativaSeleccionadaId) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
        <MgaAlert 
          message="Debe seleccionar una alternativa ganadora en la pestaña de Evaluación (Módulo 03 - Decisión) antes de proceder con la programación." 
          variant="error" 
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">01 - Indicadores de producto</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {cadenaValor.objetivos && Array.isArray(cadenaValor.objetivos) && cadenaValor.objetivos.map((obj: any) => (
        <div key={obj.id} className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleAccordion(obj.id)}
            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              {openAccordions[obj.id] ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
              <span className="font-semibold text-slate-700">Objetivo: {obj.description}</span>
            </div>
          </button>
          
          {openAccordions[obj.id] && (
            <div className="p-4 bg-white space-y-4">
              {obj.productos && obj.productos.length > 0 ? obj.productos.map((prod: any) => {
                const costoTotal = prod.actividades?.reduce((acc: number, act: any) => 
                  acc + (act.costos?.reduce((sum: number, cost: any) => sum + (cost.valor || 0), 0) || 0), 0) || 0;
                return (
                <div key={prod.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Producto Info */}
                    <div className="flex-1 space-y-3">
                      <div className="bg-slate-50 p-3 rounded border">
                        <p className="text-xs text-slate-500 font-semibold mb-1">Producto</p>
                        <p className="text-sm font-medium text-slate-800">{prod.descripcion}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded border">
                          <p className="text-xs text-slate-500 font-semibold mb-1">Meta Total</p>
                          <p className="text-sm font-medium text-slate-800">{prod.cantidad || 0} {prod.unidadMedidaId}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded border">
                          <p className="text-xs text-slate-500 font-semibold mb-1">Costo Original</p>
                          <p className="text-sm font-medium text-slate-800">
                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(costoTotal)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenWizard(prod.id, prod)}
                        className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#2980b9] text-white rounded-lg hover:bg-[#1a6698] transition-colors"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Asociar otro indicador
                      </button>
                    </div>

                    {/* Indicadores List */}
                    <div className="flex-1 space-y-3">
                      <p className="text-sm font-semibold text-slate-700">Indicadores Programados</p>
                      {!(indicadoresProgramados[prod.id]?.length > 0) ? (
                        <div className="p-4 border border-dashed rounded text-center text-slate-500 text-xs">
                          No hay indicadores asociados a este producto
                        </div>
                      ) : (
                        indicadoresProgramados[prod.id].map(ind => (
                          <div key={ind.id} className="border border-slate-200 rounded-lg p-3 relative group">
                            <button
                              onClick={() => handleDeleteIndicator(prod.id, ind.id)}
                              className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-2 mb-2">
                              {ind.esPrincipal && <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Principal</span>}
                              {ind.esAcumulativo ? 
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Acumulativo</span> :
                                <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">No Acumulativo</span>
                              }
                            </div>
                            <p className="font-semibold text-slate-800 mb-1">{ind.nombre}</p>
                            <p className="text-xs text-slate-500 mb-2">Fuente: {ind.fuenteVerificacion} - {ind.detalleFuente}</p>
                            
                            <div className="bg-slate-50 rounded p-2 text-xs">
                              <p className="font-semibold text-slate-700 mb-1">Metas por periodo:</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(ind.metasPeriodo).map(([per, val]) => (
                                  <div key={per} className="bg-white border rounded px-2 py-1 text-[10px]">
                                    <span className="text-slate-500 mr-1">P{per}:</span>
                                    <span className="font-semibold text-slate-800">{val}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}) : (
                <div className="p-4 border border-dashed rounded text-center text-slate-500">
                  No hay productos definidos para este objetivo.
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Wizard Modal */}
      {wizardOpen && wizardProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">
                Asociar indicador al producto
              </h2>
              <button onClick={() => setWizardOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="mb-6 flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${wizardStep >= 1 ? 'bg-[#2980b9] text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
                <div className={`h-1 flex-1 mx-2 ${wizardStep >= 2 ? 'bg-[#2980b9]' : 'bg-slate-200'}`}></div>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${wizardStep >= 2 ? 'bg-[#2980b9] text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
              </div>

              {error && <div className="mb-4"><MgaAlert message={error} variant="error" onDismiss={() => setError(null)} /></div>}

              {wizardStep === 1 ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm mb-4">
                    <strong>Producto:</strong> {wizardProduct.descripcion} (Meta total: {wizardProduct.cantidad})
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Indicador de Producto <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={wIndicator.id}
                      onChange={(e) => setWIndicator({
                        id: e.target.value,
                        nombre: e.target.options[e.target.selectedIndex].text
                      })}
                      className="w-full p-2 border rounded bg-white"
                    >
                      <option value="">Seleccione un indicador del catálogo...</option>
                      <option value="ind-1">Porcentaje de avance físico</option>
                      <option value="ind-2">Número de unidades entregadas</option>
                      <option value="ind-3">Tasa de cobertura</option>
                      <option value="ind-4">Indicador de calidad estandarizado</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4">
                    <input
                      type="checkbox"
                      id="chkAcum"
                      checked={wEsAcumulativo}
                      onChange={(e) => setWEsAcumulativo(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <label htmlFor="chkAcum" className="text-sm font-medium text-slate-700">
                      Es acumulativo (las metas por periodo se suman)
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tipo de Fuente de Verificación <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={wFuente}
                        onChange={(e) => setWFuente(e.target.value)}
                        className="w-full p-2 border rounded bg-white"
                      >
                        <option value="">Seleccione...</option>
                        <option value="Documento oficial">Documento oficial</option>
                        <option value="Encuesta">Encuesta</option>
                        <option value="Registro administrativo">Registro administrativo</option>
                        <option value="Informe de interventoría">Informe de interventoría</option>
                      </select>
                    </div>
                    <div>
                      <AIAssistedField label="Detalle Fuente de Verificación" htmlFor="indicador-producto-fuente-detalle" required guidance="Especifique el documento, registro o sistema donde se puede consultar la evidencia." askPrompt="Ayúdame a redactar el detalle de una fuente de verificación de un indicador MGA.">
                        <CountedTextarea id="indicador-producto-fuente-detalle" value={wDetalle} onChange={(e) => setWDetalle(e.target.value)} className="w-full resize-none rounded border bg-white p-2" rows={2} maxLength={500} placeholder="Especifique dónde se encuentra o cómo acceder a esta fuente..." />
                      </AIAssistedField>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm mb-4">
                    <p><strong>Indicador:</strong> {wIndicator.nombre}</p>
                    <p><strong>Tipo:</strong> {wEsAcumulativo ? 'Acumulativo (suma total)' : 'No acumulativo (valor constante o máximo)'}</p>
                    <p><strong>Meta del producto a alcanzar:</strong> {wizardProduct.cantidad} {wizardProduct.unidadMedidaId}</p>
                  </div>

                  <div className="overflow-x-auto border rounded bg-white">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#6c757d] text-white">
                        <tr>
                          <th className="p-2 border font-semibold">Periodo</th>
                          <th className="p-2 border font-semibold">Meta Programada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: durationYears + 1 }).map((_, i) => (
                          <tr key={i} className="border-b hover:bg-slate-50">
                            <td className="p-2 border w-1/3">Periodo {i}</td>
                            <td className="p-2 border">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={wMetas[i] || ''}
                                onChange={(e) => setWMetas((prev: Record<number, number>) => ({ ...prev, [i]: Number(e.target.value) || 0 }))}
                                className="w-full p-1.5 border rounded"
                              />
                            </td>
                          </tr>
                        ))}
                        {wEsAcumulativo && (
                          <tr className="bg-slate-100 font-bold">
                            <td className="p-2 border text-right">TOTAL ACUMULADO:</td>
                            <td className={`p-2 border ${
                              (Object.values(wMetas) as any[]).reduce((a: number, b: any) => a + (Number(b) || 0), 0) > (wizardProduct.cantidad || 0) 
                              ? 'text-red-600' : 'text-emerald-600'
                            }`}>
                              {(Object.values(wMetas) as any[]).reduce((a: number, b: any) => a + (Number(b) || 0), 0)} / {wizardProduct.cantidad}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
              {wizardStep === 1 ? (
                <>
                  <button onClick={() => setWizardOpen(false)} className="px-4 py-2 border rounded bg-white hover:bg-slate-50 font-medium">Cancelar</button>
                  <button onClick={handleNextStep} className="px-4 py-2 bg-[#2980b9] text-white rounded hover:bg-[#1a6698] font-medium">Siguiente</button>
                </>
              ) : (
                <>
                  <button onClick={() => setWizardStep(1)} className="px-4 py-2 border rounded bg-white hover:bg-slate-50 font-medium">Atrás</button>
                  <button onClick={handleNextStep} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-medium">Guardar Metas</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
