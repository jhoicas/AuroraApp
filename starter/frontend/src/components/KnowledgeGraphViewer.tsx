import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import {
  nodeTypeColors,
  nodeTypeLabels,
  relationshipLabels,
  useAiKnowledgeStore,
  type KnowledgeGraphNode,
} from '../store/aiKnowledgeStore';

const ForceGraph2D = lazy(() => import('react-force-graph-2d'));

type GraphDatum = KnowledgeGraphNode & { color: string; val: number; x?: number; y?: number };

type KnowledgeGraphViewerProps = {
  /** Solo lectura: desactiva arrastre de nodos (exploración: zoom/pan/click). */
  readOnly?: boolean;
  /** Altura mínima del canvas. */
  minHeight?: number;
  title?: string;
  subtitle?: string;
  emptyHint?: string;
  /** Notifica selección de nodo (p. ej. insertar etiqueta en el chat). */
  onNodeSelect?: (node: KnowledgeGraphNode) => void;
  className?: string;
};

/**
 * Visor interactivo del Knowledge Graph (react-force-graph-2d).
 * Consumido por Super Admin (escritura aparte) y tenants (solo lectura).
 */
export default function KnowledgeGraphViewer({
  readOnly = false,
  minHeight = 420,
  title = 'Grafo del cerebro',
  subtitle,
  emptyHint = 'Aún no hay conocimiento indexado en el cerebro global.',
  onNodeSelect,
  className = '',
}: KnowledgeGraphViewerProps) {
  const { graph, loadingGraph, error, fetchGraph, clearError } = useAiKnowledgeStore();
  const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
  const [hoverNode, setHoverNode] = useState<KnowledgeGraphNode | null>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchGraph();
  }, [fetchGraph]);

  const graphData = useMemo(() => {
    if (!graph) {
      return {
        nodes: [] as GraphDatum[],
        links: [] as { source: string; target: string; relationship: string }[],
      };
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
  const resolvedSubtitle =
    subtitle ??
    `${stats.fragments} nodos · ${stats.links} relaciones · ${stats.projects} proyectos`;

  return (
    <section className={`bg-white border border-gray-200 rounded-xl p-5 flex flex-col min-h-[520px] ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{resolvedSubtitle}</p>
          {readOnly && (
            <p className="text-xs text-teal-700 mt-1 inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">visibility</span>
              Solo lectura — explore zoom, pan y detalles de nodos
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => graphRef.current?.zoomToFit?.(400, 40)}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162]"
        >
          Centrar vista
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex items-start gap-2"
        >
          <span className="material-symbols-outlined text-base shrink-0">error</span>
          <span className="flex-1">{error}</span>
          <button type="button" onClick={clearError} className="text-red-600 underline text-xs">
            Cerrar
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {(Object.keys(nodeTypeLabels) as Array<keyof typeof nodeTypeLabels>).map((type) => (
          <span
            key={type}
            className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-gray-50 border border-gray-200"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: nodeTypeColors[type] }}
              aria-hidden
            />
            {nodeTypeLabels[type]}
          </span>
        ))}
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 rounded-lg border border-gray-100 bg-slate-950 overflow-hidden"
        style={{ minHeight }}
      >
        {loadingGraph && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm z-10 bg-slate-950/80">
            Cargando grafo…
          </div>
        )}
        {!loadingGraph && graphData.nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm p-6 text-center">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-60">hub</span>
            {emptyHint}
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
              height={containerRef.current?.clientHeight ?? minHeight}
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
              enableNodeDrag={!readOnly}
              enableZoomInteraction
              enablePanInteraction
              onNodeClick={(node) => {
                const selected = node as KnowledgeGraphNode;
                setSelectedNode(selected);
                onNodeSelect?.(selected);
              }}
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
  );
}
