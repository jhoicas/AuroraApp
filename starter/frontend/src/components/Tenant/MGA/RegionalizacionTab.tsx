import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type RegionalizacionProducto } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';

export default function RegionalizacionTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveProgramacion = useProjectMgaStore((s) => s.saveProgramacion);
  
  const alternativaSeleccionadaId = formulation.evaluacion?.alternativaSeleccionadaId;
  const cadenaValor = (formulation.cadenaValor as any)?.[alternativaSeleccionadaId as string] || { objetivos: [] };
  const locPrep = formulation.localizacionPreparacion?.[alternativaSeleccionadaId as string] || { ubicaciones: [] };
  const ubicaciones = locPrep.ubicaciones || [];
  
  const programacion = formulation.programacion || {};
  const regionalizacion = programacion.regionalizacion || {};
  
  const durationYears = 4; // Default to 4 years if not available on project

  // Collect all products from cadena de valor
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
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  const selectedProduct = allProducts.find(p => p.id === selectedProductId);

  // Local state for edits
  const [localReg, setLocalReg] = useState<Record<string, RegionalizacionProducto[]>>(regionalizacion);

  const lastSavedRef = useRef<string>('');
  const isFirstMount = useRef(true);
  
  useEffect(() => {
    setLocalReg(regionalizacion);
  }, [JSON.stringify(regionalizacion)]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      lastSavedRef.current = JSON.stringify({ regionalizacion: localReg });
      return;
    }
    const serialized = JSON.stringify({ regionalizacion: localReg });
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;
    
    const existing = useProjectMgaStore.getState().getFormulation(project.id).programacion || {};
    const merged = { ...existing, regionalizacion: localReg };
    void saveProgramacion(project.id, merged);
  }, [localReg, project.id, saveProgramacion]);

  const handleToggleRow = (locId: string) => {
    setOpenRows(prev => ({ ...prev, [locId]: !prev[locId] }));
  };

  const handleUpdate = (locId: string, periodo: number, field: 'costo' | 'meta' | 'beneficiarios', value: string) => {
    if (!selectedProductId) return;
    const numValue = Number(value) || 0;
    
    setLocalReg(prev => {
      const prodReg = prev[selectedProductId] || [];
      const existingLocIndex = prodReg.findIndex(r => r.localizacionId === locId);
      
      let newProdReg = [...prodReg];
      
      if (existingLocIndex >= 0) {
        newProdReg[existingLocIndex] = {
          ...newProdReg[existingLocIndex],
          distribucionPeriodos: {
            ...newProdReg[existingLocIndex].distribucionPeriodos,
            [periodo]: {
              ...newProdReg[existingLocIndex].distribucionPeriodos?.[periodo],
              [field]: numValue
            }
          }
        };
      } else {
        newProdReg.push({
          id: crypto.randomUUID(),
          localizacionId: locId,
          distribucionPeriodos: {
            [periodo]: { costo: 0, meta: 0, beneficiarios: 0, [field]: numValue }
          }
        });
      }
      
      return { ...prev, [selectedProductId]: newProdReg };
    });
  };

  if (!alternativaSeleccionadaId) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
        <MgaAlert 
          message="Debe seleccionar una alternativa ganadora en la pestaña de Evaluación (Módulo 03 - Decisión) antes de proceder con la regionalización." 
          variant="error" 
        />
      </div>
    );
  }

  if (allProducts.length === 0) {
    return (
      <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
        <MgaAlert message="No hay productos definidos en la Cadena de Valor para esta alternativa." variant="warning" />
      </div>
    );
  }

  // Calculos de totales
  let totalCostoOriginal = 0;
  if (selectedProduct) {
    totalCostoOriginal = selectedProduct.actividades?.reduce((acc: number, act: any) => 
      acc + (act.costos?.reduce((sum: number, cost: any) => sum + (cost.valor || 0), 0) || 0), 0) || 0;
  }
  const totalMetaOriginal = selectedProduct?.cantidad || 0;
  const totalBenOriginal = selectedProduct?.poblacion?.numero || 0;

  const currentProdReg = localReg[selectedProductId] || [];
  
  let totalCostoReg = 0;
  let totalMetaReg = 0;
  let totalBenReg = 0;

  currentProdReg.forEach(loc => {
    Object.values(loc.distribucionPeriodos || {}).forEach(p => {
      totalCostoReg += (p.costo || 0);
      totalMetaReg += (p.meta || 0);
      totalBenReg += (p.beneficiarios || 0);
    });
  });

  const pendienteCosto = totalCostoOriginal - totalCostoReg;
  const pendienteMeta = totalMetaOriginal - totalMetaReg;
  const pendienteBen = totalBenOriginal - totalBenReg;

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">02 - Regionalización</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Seleccione un producto para regionalizar:
        </label>
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:border-[#2980b9] bg-white text-sm"
        >
          {allProducts.map(prod => (
            <option key={prod.id} value={prod.id}>
              {prod.descripcion} (Meta: {prod.cantidad}, Población: {prod.poblacion?.numero || 0})
            </option>
          ))}
        </select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700 border-b">
              <tr>
                <th className="p-3 w-10"></th>
                <th className="p-3">Ubicación (Región / Departamento / Municipio)</th>
                <th className="p-3">Georeferenciada</th>
              </tr>
            </thead>
            <tbody>
              {ubicaciones.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-slate-500">
                    No hay localizaciones definidas para esta alternativa.
                  </td>
                </tr>
              ) : (
                ubicaciones.map((loc: any) => {
                  const isOpen = openRows[loc.id];
                  const locReg = currentProdReg.find(r => r.localizacionId === loc.id)?.distribucionPeriodos || {};
                
                  return (
                    <React.Fragment key={loc.id}>
                      <tr className="border-b hover:bg-slate-50 transition-colors">
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleToggleRow(loc.id)}
                            className="p-1 hover:bg-slate-200 rounded text-slate-500"
                          >
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
                        <td className="p-3 text-slate-600">
                          {loc.georeferenciada ? 'Sí' : 'No'}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/50 border-b">
                          <td colSpan={3} className="p-4">
                            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100 text-slate-600 border-b">
                                  <tr>
                                    <th className="p-2 font-semibold">Periodo</th>
                                    <th className="p-2 font-semibold text-right">Costo Total</th>
                                    <th className="p-2 font-semibold text-right">Meta Regionalizada</th>
                                    <th className="p-2 font-semibold text-right">Beneficiarios</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.from({ length: durationYears + 1 }).map((_, i) => (
                                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                      <td className="p-2 font-medium text-slate-600">Año {i}</td>
                                      <td className="p-2">
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={locReg[i]?.costo || ''}
                                          onChange={(e) => handleUpdate(loc.id, i, 'costo', e.target.value)}
                                          className="w-full p-1.5 border rounded text-right bg-white focus:border-[#2980b9] outline-none"
                                          placeholder="0"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={locReg[i]?.meta || ''}
                                          onChange={(e) => handleUpdate(loc.id, i, 'meta', e.target.value)}
                                          className="w-full p-1.5 border rounded text-right bg-white focus:border-[#2980b9] outline-none"
                                          placeholder="0"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={locReg[i]?.beneficiarios || ''}
                                          onChange={(e) => handleUpdate(loc.id, i, 'beneficiarios', e.target.value)}
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b">Total Costo</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Costo original:</span>
              <span className="font-medium text-slate-800">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalCostoOriginal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total regionalizado:</span>
              <span className="font-medium text-blue-600">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalCostoReg)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold text-slate-700">Pendiente:</span>
              <span className={`font-bold ${pendienteCosto < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(pendienteCosto)}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b">Total Meta</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Meta original:</span>
              <span className="font-medium text-slate-800">{totalMetaOriginal} {selectedProduct?.unidadMedidaId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total regionalizado:</span>
              <span className="font-medium text-emerald-600">{totalMetaReg}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold text-slate-700">Pendiente:</span>
              <span className={`font-bold ${pendienteMeta < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {pendienteMeta}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b">Total Beneficiarios</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Beneficiarios original:</span>
              <span className="font-medium text-slate-800">{totalBenOriginal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total regionalizado:</span>
              <span className="font-medium text-purple-600">{totalBenReg}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold text-slate-700">Pendiente:</span>
              <span className={`font-bold ${pendienteBen < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                {pendienteBen}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
