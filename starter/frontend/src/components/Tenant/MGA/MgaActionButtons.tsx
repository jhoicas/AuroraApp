import React, { useState } from 'react';
import { Download, Printer, FileText, X, Trash2, Upload } from 'lucide-react';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import type { Project } from '../../../store/projectStore';

export type MgaActionButtonsProps = {
  project: Project;
  onSave?: () => Promise<void> | void;
};

export default function MgaActionButtons({ project, onSave }: MgaActionButtonsProps) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveDocumentosSoporte = useProjectMgaStore((s) => s.saveDocumentosSoporte);
  const isSavingGlobal = useProjectMgaStore((s) => s.isSaving);

  const [modalOpen, setModalOpen] = useState(false);
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  const handleSaveClick = async () => {
    if (!onSave) return;
    setSavedStatus('saving');
    try {
      await onSave();
      setSavedStatus('success');
      setTimeout(() => setSavedStatus('idle'), 3000);
    } catch (error) {
      setSavedStatus('idle');
    }
  };

  const handleExportXML = () => {
    // Generar XML estructurado simulado
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<ProyectoMGA>
  <Identificacion>
    <CodigoBPIN>${project.code_bpin || ''}</CodigoBPIN>
    <Nombre>${project.name || ''}</Nombre>
  </Identificacion>
  <Preparacion>
    <NecesidadesCount>${Object.keys(formulation.preparacion?.necesidades || {}).length}</NecesidadesCount>
  </Preparacion>
  <Evaluacion>
    <!-- Datos de evaluacion -->
  </Evaluacion>
  <Programacion>
    <!-- Datos de programacion -->
  </Programacion>
</ProyectoMGA>`;
    
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proyecto_mga_${project.id}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const newDoc = {
        id: Math.random().toString(36).substr(2, 9),
        nombre: file.name,
        fechaCarga: new Date().toLocaleDateString('es-CO') + ' ' + new Date().toLocaleTimeString('es-CO'),
        url: '#' // Simulado
      };
      const currentDocs = formulation.documentosSoporte || [];
      saveDocumentosSoporte(project.id, [...currentDocs, newDoc]);
    }
  };

  const handleRemoveDoc = (docId: string) => {
    const currentDocs = formulation.documentosSoporte || [];
    saveDocumentosSoporte(project.id, currentDocs.filter(d => d.id !== docId));
  };

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 border-t print:hidden">
      <div className="flex items-center gap-2">
        {onSave && (
          <>
            <button 
              onClick={handleSaveClick}
              disabled={savedStatus === 'saving'}
              className="px-6 py-2 bg-[#2980b9] text-white font-medium rounded-lg hover:bg-[#1a6698] flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {savedStatus === 'saving' ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              Guardar y Continuar
            </button>
            {savedStatus === 'success' && (
              <span className="text-green-600 text-sm font-medium flex items-center gap-1 ml-2 animate-pulse">
                ✅ Guardado correctamente
              </span>
            )}
          </>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          onClick={handleExportXML}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
        >
          <Download className="w-4 h-4" /> Generar XML
        </button>

        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
        >
          <Printer className="w-4 h-4" /> Imprimir
        </button>

        <button 
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
        >
          <FileText className="w-4 h-4" /> Documentos de Soporte
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800">Documentos de Soporte</h2>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="flex items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-[#2980b9] focus:outline-none">
                  <span className="flex items-center space-x-2">
                    <Upload className="w-6 h-6 text-gray-600" />
                    <span className="font-medium text-gray-600">
                      Haga clic para adjuntar un documento (Simulación)
                    </span>
                  </span>
                  <input type="file" name="file_upload" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Documentos Adjuntos</h3>
                {(!formulation.documentosSoporte || formulation.documentosSoporte.length === 0) ? (
                  <p className="text-sm text-slate-500 italic">No hay documentos de soporte adjuntos.</p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="p-3 border-b">Nombre</th>
                          <th className="p-3 border-b">Fecha de Carga</th>
                          <th className="p-3 border-b text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formulation.documentosSoporte.map((doc) => (
                          <tr key={doc.id} className="border-b hover:bg-slate-50">
                            <td className="p-3 text-slate-700 font-medium">{doc.nombre}</td>
                            <td className="p-3 text-slate-500">{doc.fechaCarga}</td>
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => handleRemoveDoc(doc.id)}
                                disabled={isSavingGlobal}
                                className="text-red-500 hover:text-red-700 p-1 rounded"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end">
              <button 
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-[#2980b9] text-white rounded hover:bg-[#1a6698]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
