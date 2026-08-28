import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import AiAuditPanel from '../../components/admin/AiAuditPanel';
import KnowledgeGraphViewer from '../../components/KnowledgeGraphViewer';
import { nodeTypeColors, nodeTypeLabels, useAiKnowledgeStore } from '../../store/aiKnowledgeStore';

export default function AIKnowledgePage() {
  const { lastIngest, ingesting, error, ingestXml, clearError } = useAiKnowledgeStore();

  const onDrop = useCallback(
    async (accepted: File[]) => {
      clearError();
      for (const file of accepted) {
        try {
          await ingestXml(file);
        } catch {
          /* error en store */
        }
      }
    },
    [clearError, ingestXml],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: (files) => void onDrop(files),
    accept: { 'application/xml': ['.xml'], 'text/xml': ['.xml'] },
    maxFiles: 5,
    disabled: ingesting,
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Cerebro IA — Knowledge Base MGA</h2>
          <p className="text-base md:text-lg text-gray-600 max-w-3xl">
            Motor financiero nativo en Go, grafo semántico relacional y telemetría de uso. Ingesta XML
            ProjectSummary para indexar el conocimiento de formulación MGA (recurso global).
          </p>
        </div>
        <span className="inline-flex self-start bg-teal-100 text-[#006162] px-3 py-1 rounded-full text-sm font-semibold">
          RAG · pgvector · telemetría
        </span>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2"
        >
          <span className="material-symbols-outlined text-base shrink-0">error</span>
          <span>{error}</span>
          <button type="button" onClick={clearError} className="ml-auto text-red-600 underline text-xs">
            Cerrar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-5">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Ingesta MGA (XML)</h3>
            <p className="text-sm text-gray-500 mt-1">
              Exclusivo SUPER_ADMIN. Extrae Project, CentralProblem, Cause, Effect, SpecificObjective,
              Alternative, Product y Activity con relaciones semánticas.
            </p>
          </div>

          <div
            {...getRootProps()}
            className={`relative cursor-pointer transition-all border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center min-h-[220px] text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] ${
              isDragReject
                ? 'border-red-400 bg-red-50'
                : isDragActive
                  ? 'bg-teal-50 border-[#006162] scale-[1.01]'
                  : 'bg-teal-50/50 border-teal-600'
            } ${ingesting ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <input {...getInputProps()} aria-label="Subir XML MGA ProjectSummary" />
            <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-3xl text-[#006162]">
                {ingesting ? 'hourglass_top' : 'upload_file'}
              </span>
            </div>
            <p className="text-base font-semibold text-gray-900 mb-1">
              {ingesting ? 'Aprendiendo del XML…' : 'Arrastra ProjectSummary.xml aquí'}
            </p>
            <p className="text-sm text-gray-500">Jerarquía MGA con relaciones has_problem, has_cause…</p>
          </div>

          {lastIngest && (
            <div className="rounded-lg border border-teal-200 bg-teal-50/80 p-4 text-sm text-gray-800">
              <p className="font-semibold text-[#006162] mb-2 inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-base">psychology</span>
                Resumen de aprendizaje
              </p>
              <p className="mb-2">{lastIngest.message}</p>
              <ul className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <li>
                  Nodos: <strong>{lastIngest.nodes_created}</strong>
                </li>
                <li>
                  Relaciones: <strong>{lastIngest.links_created}</strong>
                </li>
                <li>
                  Causas: <strong>{lastIngest.causes}</strong>
                </li>
                <li>
                  Efectos: <strong>{lastIngest.effects}</strong>
                </li>
                <li>
                  Alternativas: <strong>{lastIngest.alternatives}</strong>
                </li>
                <li>
                  Actividades: <strong>{lastIngest.activities}</strong>
                </li>
              </ul>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
              Leyenda visual
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(nodeTypeLabels).map(([type, label]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-gray-50 border border-gray-200"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: nodeTypeColors[type] }}
                    aria-hidden
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <KnowledgeGraphViewer
          title="Grafo del cerebro (Obsidian)"
          emptyHint="Aún no hay conocimiento indexado. Sube un XML MGA para poblar el grafo."
        />
      </div>

      <AiAuditPanel />
    </div>
  );
}
