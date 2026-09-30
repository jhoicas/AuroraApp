import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, debouncedPatchProject, type ProblematicaJson, type ArbolNodoCausa, type ArbolNodoEfecto } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';

export default function ProblematicaTab({ project }: { project: Project }) {
  const [error, setError] = useState<string | null>(null);

  const initialProblematica = useProjectMgaStore.getState().getFormulation(project.id)?.identificacion?.problematica;

  const [problemaCentral, setProblemaCentral] = useState(initialProblematica?.problemaCentral || '');
  const [efectos, setEfectos] = useState<ArbolNodoEfecto[]>(initialProblematica?.efectos || []);
  const [causas, setCausas] = useState<ArbolNodoCausa[]>(initialProblematica?.causas || []);
  const [descripcionSituacion, setDescripcionSituacion] = useState(initialProblematica?.descripcionSituacion || '');
  const [magnitudIndicadores, setMagnitudIndicadores] = useState(initialProblematica?.magnitudIndicadores || '');

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  const lastSavedRef = useRef<string>(JSON.stringify({
    problemaCentral: initialProblematica?.problemaCentral || '',
    efectos: initialProblematica?.efectos || [],
    causas: initialProblematica?.causas || [],
    descripcionSituacion: initialProblematica?.descripcionSituacion || '',
    magnitudIndicadores: initialProblematica?.magnitudIndicadores || ''
  }));

  // Sync state if project changes
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      const currentData = useProjectMgaStore.getState().getFormulation(project.id)?.identificacion?.problematica;
      setProblemaCentral(currentData?.problemaCentral || '');
      setEfectos(currentData?.efectos || []);
      setCausas(currentData?.causas || []);
      setDescripcionSituacion(currentData?.descripcionSituacion || '');
      setMagnitudIndicadores(currentData?.magnitudIndicadores || '');
      lastSavedRef.current = JSON.stringify({
        problemaCentral: currentData?.problemaCentral || '',
        efectos: currentData?.efectos || [],
        causas: currentData?.causas || [],
        descripcionSituacion: currentData?.descripcionSituacion || '',
        magnitudIndicadores: currentData?.magnitudIndicadores || ''
      });
    }
  }, [project.id]);

  // Save changes when user edits fields
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const data: ProblematicaJson = {
      problemaCentral,
      efectos,
      causas,
      descripcionSituacion,
      magnitudIndicadores
    };

    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    const currentIdentificacion = useProjectMgaStore.getState().getFormulation(project.id)?.identificacion;

    useProjectMgaStore.setState((state) => ({
      byProjectId: {
        ...state.byProjectId,
        [project.id]: {
          ...(state.byProjectId[project.id] ?? {}),
          identificacion: {
            ...currentIdentificacion,
            problematica: data
          }
        }
      }
    }));

    debouncedPatchProject(project.id, { 
      identificacion: { 
        ...currentIdentificacion, 
        problematica: data 
      } 
    });
  }, [
    problemaCentral, efectos, causas, descripcionSituacion, magnitudIndicadores, project.id
  ]);

  const addDirectCausa = () => {
    setCausas([...causas, { id: crypto.randomUUID(), descripcion: '', tipo: 'directa' }]);
  };

  const addIndirectCausa = (parentId: string) => {
    setCausas([...causas, { id: crypto.randomUUID(), descripcion: '', tipo: 'indirecta', parentId }]);
  };

  const addDirectEfecto = () => {
    setEfectos([...efectos, { id: crypto.randomUUID(), descripcion: '', tipo: 'directo' }]);
  };

  const addIndirectEfecto = (parentId: string) => {
    setEfectos([...efectos, { id: crypto.randomUUID(), descripcion: '', tipo: 'indirecto', parentId }]);
  };

  const updateCausa = (id: string, descripcion: string) => {
    setCausas(causas.map(c => c.id === id ? { ...c, descripcion } : c));
  };

  const updateEfecto = (id: string, descripcion: string) => {
    setEfectos(efectos.map(e => e.id === id ? { ...e, descripcion } : e));
  };

  const deleteCausa = (id: string) => {
    // Delete target and its children
    const toDelete = new Set([id]);
    const remaining = causas.filter(c => {
      if (c.parentId && toDelete.has(c.parentId)) {
        toDelete.add(c.id);
        return false;
      }
      return !toDelete.has(c.id);
    });
    setCausas(remaining);
  };

  const deleteEfecto = (id: string) => {
    // Delete target and its children
    const toDelete = new Set([id]);
    const remaining = efectos.filter(e => {
      if (e.parentId && toDelete.has(e.parentId)) {
        toDelete.add(e.id);
        return false;
      }
      return !toDelete.has(e.id);
    });
    setEfectos(remaining);
  };

  const renderCausas = () => {
    const directas = causas.filter(c => c.tipo === 'directa');
    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-slate-700">Causas</h4>
        {directas.map(d => (
          <div key={d.id} className="border border-slate-200 rounded p-4 bg-slate-50 relative">
            <div className="flex gap-2 mb-2">
              <input 
                spellCheck={true}
                type="text" 
                value={d.descripcion} 
                onChange={(e) => updateCausa(d.id, e.target.value)} 
                placeholder="Causa Directa"
                className="w-full border-slate-300 rounded px-2 py-1 text-sm"
              />
              <button onClick={() => deleteCausa(d.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4"/></button>
            </div>
            
            <div className="pl-6 space-y-2 mt-2 border-l-2 border-dashed border-slate-300">
              {causas.filter(i => i.parentId === d.id).map(i => (
                <div key={i.id} className="flex gap-2">
                  <input 
                    spellCheck={true}
                    type="text" 
                    value={i.descripcion} 
                    onChange={(e) => updateCausa(i.id, e.target.value)} 
                    placeholder="Causa Indirecta"
                    className="w-full border-slate-300 rounded px-2 py-1 text-sm"
                  />
                  <button onClick={() => deleteCausa(i.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              <button 
                onClick={() => addIndirectCausa(d.id)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
              >
                <Plus className="w-3 h-3" /> Adicionar Causa Indirecta
              </button>
            </div>
          </div>
        ))}
        <button 
          onClick={addDirectCausa}
          className="text-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded px-3 py-1.5 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Adicionar Causa Directa
        </button>
      </div>
    );
  };

  const renderEfectos = () => {
    const directos = efectos.filter(e => e.tipo === 'directo');
    return (
      <div className="space-y-4">
        <h4 className="font-semibold text-slate-700">Efectos</h4>
        {directos.map(d => (
          <div key={d.id} className="border border-slate-200 rounded p-4 bg-slate-50 relative">
            <div className="flex gap-2 mb-2">
              <input 
                spellCheck={true}
                type="text" 
                value={d.descripcion} 
                onChange={(e) => updateEfecto(d.id, e.target.value)} 
                placeholder="Efecto Directo"
                className="w-full border-slate-300 rounded px-2 py-1 text-sm"
              />
              <button onClick={() => deleteEfecto(d.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4"/></button>
            </div>
            
            <div className="pl-6 space-y-2 mt-2 border-l-2 border-dashed border-slate-300">
              {efectos.filter(i => i.parentId === d.id).map(i => (
                <div key={i.id} className="flex gap-2">
                  <input 
                    spellCheck={true}
                    type="text" 
                    value={i.descripcion} 
                    onChange={(e) => updateEfecto(i.id, e.target.value)} 
                    placeholder="Efecto Indirecto"
                    className="w-full border-slate-300 rounded px-2 py-1 text-sm"
                  />
                  <button onClick={() => deleteEfecto(i.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
              <button 
                onClick={() => addIndirectEfecto(d.id)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
              >
                <Plus className="w-3 h-3" /> Adicionar Efecto Indirecto
              </button>
            </div>
          </div>
        ))}
        <button 
          onClick={addDirectEfecto}
          className="text-sm bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded px-3 py-1.5 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Adicionar Efecto Directo
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <h3 className="text-lg font-semibold text-slate-800">Árbol de Problemas</h3>
        
        {/* Efectos (Top) */}
        {renderEfectos()}
        
        {/* Problema Central (Middle) */}
        <div className="p-4 border-2 border-blue-200 bg-blue-50 rounded-lg text-center">
          <label className="block font-semibold text-blue-800 mb-2">Problema Central</label>
          <textarea 
            spellCheck={true}
            value={problemaCentral}
            onChange={(e) => setProblemaCentral(e.target.value)}
            className="w-full border-slate-300 rounded p-2 text-center resize-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="Describa el problema central..."
          />
        </div>

        {/* Causas (Bottom) */}
        {renderCausas()}
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Descripción de la situación existente con respecto al problema *</label>
          <textarea 
            spellCheck={true}
            value={descripcionSituacion}
            onChange={(e) => setDescripcionSituacion(e.target.value)}
            className="w-full border-slate-300 rounded px-3 py-2 text-base min-h-[100px]"
            placeholder="Describa la situación..."
          />
        </div>
        
        <div>
          <label className="block text-base font-medium text-slate-700 mb-1">Magnitud actual del problema e indicadores de referencia *</label>
          <textarea 
            spellCheck={true}
            value={magnitudIndicadores}
            onChange={(e) => setMagnitudIndicadores(e.target.value)}
            className="w-full border-slate-300 rounded px-3 py-2 text-base min-h-[100px]"
            placeholder="Indique la magnitud..."
          />
        </div>
      </div>
    </div>
  );
}
