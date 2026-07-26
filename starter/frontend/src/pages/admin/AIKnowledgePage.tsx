import { useCallback, useState } from 'react';
import CatalogImporter from '../../components/CatalogImporter';
import WikiManager from '../../components/WikiManager';

type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'done';
};

export default function AIKnowledgePage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([
    {
      id: '1',
      name: 'Ley_Contrataciones_Estado_2024.pdf',
      progress: 100,
      status: 'done',
    },
  ]);

  const onDrop = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const next: UploadItem[] = Array.from(files).map((f, i) => ({
      id: `${Date.now()}-${i}`,
      name: f.name,
      progress: 45,
      status: 'uploading' as const,
    }));
    setUploads((prev) => [...next, ...prev]);
    window.setTimeout(() => {
      setUploads((prev) =>
        prev.map((u) =>
          next.some((n) => n.id === u.id) ? { ...u, progress: 100, status: 'done' } : u,
        ),
      );
    }, 1500);
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Gestión IA Aurora</h2>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl">
            Administre la base de conocimientos normativa. Cargue documentos para actualizar el motor
            de inferencia de inversión pública.
          </p>
        </div>
        <span className="inline-flex self-start bg-teal-100 text-[#006162] px-3 py-1 rounded-full text-sm font-semibold">
          Motor v2.4 activo
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Carga de documentos</h3>

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                document.getElementById('ai-file-input')?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onDrop(e.dataTransfer.files);
            }}
            className={`relative cursor-pointer transition-all border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center min-h-[280px] text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] ${
              dragOver
                ? 'bg-teal-50 border-[#006162] scale-[1.01]'
                : 'bg-teal-50/50 border-teal-600'
            }`}
          >
            <input
              id="ai-file-input"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => onDrop(e.target.files)}
            />
            <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl text-[#006162]">cloud_upload</span>
            </div>
            <p className="text-lg font-semibold text-gray-900 mb-1">
              Arrastra y suelta documentos normativos aquí
            </p>
            <p className="text-sm text-gray-500 mb-4">PDF, Word, TXT · Máx. 50MB</p>
            <button
              type="button"
              onClick={() => document.getElementById('ai-file-input')?.click()}
              className="h-12 px-6 bg-white border-2 border-[#006162] text-[#006162] font-semibold rounded-lg hover:bg-teal-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162]"
            >
              Explorar archivos
            </button>
          </div>

          <div className="mt-8">
            <h4 className="font-semibold text-gray-800 mb-3">Subidas recientes</h4>
            <div className="space-y-2">
              {uploads.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <div className="w-10 h-10 rounded bg-teal-100 flex items-center justify-center text-[#006162]">
                    <span className="material-symbols-outlined">picture_as_pdf</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <p className="font-medium text-gray-900 truncate">{file.name}</p>
                      <span className="text-sm text-[#006162] font-semibold shrink-0">
                        {file.status === 'done' ? 'Completado' : `${file.progress}%`}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-teal-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#006162] transition-all"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
              Resumen de base
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Documentos totales</span>
                <span className="text-xl font-bold text-[#006162]">{uploads.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Última actualización</span>
                <span className="text-gray-500">Reciente</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="bg-gray-50 p-3 rounded-lg flex items-start gap-2 text-sm text-gray-600">
                <span className="material-symbols-outlined text-[#006162] text-base">info</span>
                La IA indexa parámetros territoriales y lineamientos DNP cargados aquí.
              </div>
            </div>
          </div>

          <div className="bg-[#2c7a7b] text-white rounded-xl p-5">
            <h3 className="font-semibold mb-2 inline-flex items-center gap-2">
              <span className="material-symbols-outlined">lightbulb</span>
              Consejo de admin
            </h3>
            <p className="text-sm text-white/90">
              Para mejores resultados, asegúrese de que los documentos escaneados tengan capa OCR antes
              de la carga.
            </p>
          </div>
        </aside>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-6">
        <h3 className="text-xl font-semibold text-gray-900">Herramientas de conocimiento</h3>
        <WikiManager />
        <div className="border-t border-gray-100 pt-6">
          <h4 className="font-semibold text-gray-800 mb-3">Importación de catálogo</h4>
          <CatalogImporter />
        </div>
      </section>
    </div>
  );
}
