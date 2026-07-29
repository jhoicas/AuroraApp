import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import { useDropzone } from 'react-dropzone';
import AiAuditPanel from '../../components/admin/AiAuditPanel';
import {
  nodeTypeColors,
  nodeTypeLabels,
  relationshipLabels,
  useAiKnowledgeStore,
  type KnowledgeGraphNode,
} from '../../store/aiKnowledgeStore';

const ForceGraph2D = lazy(() => import('react-force-graph-2d'));

type GraphDatum = KnowledgeGraphNode & { color: string; val: number; x?: number; y?: number };

export default function AIKnowledgePage() {
  const {
    graph,
    lastIngest,
    loadingGraph,
    ingesting,
    error,
    fetchGraph,
    ingestXml,
    clearError,
  } = useAiKnowledgeStore();

  const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
  const [hoverNode, setHoverNode] = useState<KnowledgeGraphNode | null>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchGraph();
  }, [fetchGraph]);

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

  const graphData = useMemo(() => {
    if (!graph) {
      return { nodes: [] as GraphDatum[], links: [] as { source: string; target: string; relationship: string }[] };
    }
    const nodes: GraphDatum[] = graph.nodes.map((n) => ({
      ...n,
      color: nodeTypeColors[n.type] ?? '#64748b',
      val: n.type === 'project' ? 16 : n.type === 'central_problem' ? 12 : 8,
    }));
    const links = graph.links.map((l) => ({
      source: l.source,
      target: l.target,
      relationship: l.relationship,
    }));
    return { nodes, links };
  }, [graph]);

  const stats = useMemo(() => {
    if (!graph?.nodes.length) return { projects: 0, fragments: 0, links: 0 };
    return {
      projects: graph.nodes.filter((n) => n.type === 'project').length,
      fragments: graph.nodes.length,
      links: graph.links.length,
    };
  }, [graph]);

  const activeNode = hoverNode ?? selectedNode;

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Cerebro IA — Knowledge Base MGA</h2>
          <p className="text-base md:text-lg text-gray-600 max-w-3xl">
            Motor financiero nativo en Go, grafo semántico relacional y telemetría de uso. Ingesta XML
            ProjectSummary para indexar el conocimiento de formulación MGA.
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
              Extrae Project, CentralProblem, Cause, Effect, SpecificObjective, Alternative, Product y Activity con relaciones semánticas.
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
                <li>Nodos: <strong>{lastIngest.nodes_created}</strong></li>
                <li>Relaciones: <strong>{lastIngest.links_created}</strong></li>
                <li>Causas: <strong>{lastIngest.causes}</strong></li>
                <li>Efectos: <strong>{lastIngest.effects}</strong></li>
                <li>Alternativas: <strong>{lastIngest.alternatives}</strong></li>
                <li>Actividades: <strong>{lastIngest.activities}</strong></li>
              </ul>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Leyenda visual</h4>
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

        <section className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col min-h-[520px]">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Grafo del cerebro (Obsidian)</h3>
              <p className="text-sm text-gray-500">
                {stats.fragments} nodos · {stats.links} relaciones · {stats.projects} proyectos
              </p>
            </div>
            <button
              type="button"
              onClick={() => graphRef.current?.zoomToFit?.(400, 40)}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162]"
            >
              Centrar vista
            </button>
          </div>

          <div
            ref={containerRef}
            className="relative flex-1 min-h-[420px] rounded-lg border border-gray-100 bg-slate-950 overflow-hidden"
          >
            {loadingGraph && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm z-10 bg-slate-950/80">
                Cargando grafo…
              </div>
            )}
            {!loadingGraph && graphData.nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm p-6 text-center">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-60">hub</span>
                Aún no hay conocimiento indexado. Sube un XML MGA para poblar el grafo.
              </div>
            )}
            {graphData.nodes.length > 0 && (
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">
                    Inicializando visor…
                  </div>
                }
              >
                <ForceGraph2D
                  ref={graphRef}
                  width={containerRef.current?.clientWidth}
                  height={containerRef.current?.clientHeight ?? 420}
                  graphData={graphData}
                  nodeLabel={(n) => {
                    const node = n as GraphDatum;
                    const typeLabel = nodeTypeLabels[node.type] ?? node.type;
                    const excerpt = node.content?.trim() ?? '';
                    return excerpt
                      ? `${typeLabel}: ${node.label}\n\n${excerpt}`
                      : `${typeLabel}: ${node.label}`;
                  }}
                  linkLabel={(l) => relationshipLabels[(l as { relationship: string }).relationship] ?? ''}
                  nodeCanvasObject={(node, ctx, globalScale) => {
                    const n = node as GraphDatum;
                    const label = n.label.length > 24 ? `${n.label.slice(0, 24)}…` : n.label;
                    const fontSize = Math.max(10 / globalScale, 3);
                    const r = Math.sqrt(Math.max(n.val, 1)) * 3;

                    ctx.beginPath();
                    ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI, false);
                    ctx.fillStyle = n.color;
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                    ctx.lineWidth = 1 / globalScale;
                    ctx.stroke();

                    if (globalScale > 0.55) {
                      ctx.font = `${fontSize}px system-ui, sans-serif`;
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'top';
                      ctx.fillStyle = 'rgba(226,232,240,0.95)';
                      ctx.fillText(label, n.x ?? 0, (n.y ?? 0) + r + 2);
                    }
                  }}
                  linkColor={() => 'rgba(148,163,184,0.4)'}
                  linkDirectionalParticles={2}
                  linkDirectionalParticleWidth={2}
                  linkWidth={1.2}
                  enableNodeDrag
                  enableZoomInteraction
                  enablePanInteraction
                  onNodeClick={(node) => setSelectedNode(node as KnowledgeGraphNode)}
                  onNodeHover={(node) => setHoverNode(node ? (node as KnowledgeGraphNode) : null)}
                  cooldownTicks={100}
                  onEngineStop={() => graphRef.current?.zoomToFit?.(400, 50)}
                />
              </Suspense>
            )}

            {activeNode && (
              <div
                className="absolute bottom-3 left-3 right-3 z-20 rounded-lg bg-slate-900/95 border border-slate-700 p-3 text-xs text-slate-200 shadow-lg pointer-events-none"
                role="tooltip"
              >
                <p className="font-semibold text-white mb-0.5">{activeNode.label}</p>
                <p className="text-teal-300 mb-1">{nodeTypeLabels[activeNode.type] ?? activeNode.type}</p>
                {activeNode.content && (
                  <p className="leading-relaxed text-slate-300 line-clamp-4">{activeNode.content}</p>
                )}
              </div>
            )}
          </div>

          {selectedNode && (
            <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm">
              <div className="flex justify-between items-start gap-2 mb-1">
                <p className="font-semibold text-gray-900">{selectedNode.label}</p>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] rounded"
                  aria-label="Cerrar detalle"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
              <p className="text-xs text-[#006162] font-medium mb-1">
                {nodeTypeLabels[selectedNode.type] ?? selectedNode.type}
              </p>
              {selectedNode.content && (
                <p className="text-gray-600 text-xs leading-relaxed whitespace-pre-wrap">{selectedNode.content}</p>
              )}
            </div>
          )}
        </section>
      </div>

      <AiAuditPanel />
    </div>
  );
}
