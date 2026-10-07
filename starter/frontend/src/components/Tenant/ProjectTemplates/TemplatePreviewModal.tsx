import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, X } from 'lucide-react';
import type { ProjectTemplate, TemplateParticipant } from '../../../data/mgaSeedTemplate';
import type { ProductoCvJson, RiesgoJson } from '../../../store/projectMgaStore';

type TabKey =
  | 'problematica'
  | 'identificacion'
  | 'participantes'
  | 'poblacion'
  | 'objetivos'
  | 'alternativas'
  | 'riesgos'
  | 'indicadores'
  | 'focalizacion';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'problematica', label: 'Problemática' },
  { key: 'identificacion', label: 'Identificación' },
  { key: 'participantes', label: 'Participantes' },
  { key: 'poblacion', label: 'Población' },
  { key: 'objetivos', label: 'Objetivos' },
  { key: 'alternativas', label: 'Cadena de valor' },
  { key: 'riesgos', label: 'Riesgos' },
  { key: 'indicadores', label: 'Indicadores' },
  { key: 'focalizacion', label: 'Focalización' },
];

const ACTORES: Record<number, string> = { 1: 'Nacional', 2: 'Departamental', 4: 'Municipal', 6: 'Otro', 7: 'Localidad' };
const POSICIONES: Record<number, string> = { 1: 'Beneficiario', 2: 'Cooperante', 3: 'Oponente', 4: 'Perjudicado' };
const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('es-CO');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#006162]">{title}</h4>
      {children}
    </section>
  );
}

function Text({ children }: { children: ReactNode }) {
  return <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">{children || '—'}</p>;
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-[#006162]">{children}</span>;
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold text-gray-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-gray-100 align-top">
              {cells.map((c, j) => (
                <td key={j} className="px-3 py-2 text-gray-800">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function productCost(p: ProductoCvJson): number {
  return p.actividades.reduce((acc, a) => acc + a.costos.reduce((s, c) => s + c.valor, 0), 0);
}

type PreviewProps = {
  template: ProjectTemplate | null;
  onClose: () => void;
  onUse: (template: ProjectTemplate) => void;
  canUse: boolean;
};

export default function TemplatePreviewModal({ template, onClose, onUse, canUse }: PreviewProps) {
  const [tab, setTab] = useState<TabKey>('problematica');

  useEffect(() => {
    if (!template) return undefined;
    setTab('problematica');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [template, onClose]);

  const data = useMemo(() => {
    const f = template?.formulation;
    const iden = f?.identificacion;
    const prep = f?.preparacion;
    const altId = f?.evaluacion?.alternativaSeleccionadaId ?? iden?.alternativas?.[0]?.id ?? '';
    return {
      f,
      iden,
      altId,
      productos: Object.entries(prep?.cadenaValorPrep?.[altId]?.objetivos ?? {}),
      riesgos: (prep?.riesgos?.[altId] ?? []) as RiesgoJson[],
      participants: (f?.participants ?? []) as TemplateParticipant[],
    };
  }, [template]);

  if (!template) return null;
  const { f, iden, productos, riesgos, participants } = data;
  const objetivos = iden?.objetivos;
  const causasDirectas = iden?.problematica?.causas.filter((c) => c.tipo === 'directa') ?? [];

  const body: Record<TabKey, ReactNode> = {
    problematica: (
      <>
        <Section title="Problema central">
          <Text>{iden?.problematica?.problemaCentral}</Text>
        </Section>
        <div className="grid gap-5 md:grid-cols-2">
          <Section title="Causas">
            <ul className="space-y-2">
              {iden?.problematica?.causas.map((c) => (
                <li key={c.id} className={`text-sm text-gray-800 ${c.tipo === 'indirecta' ? 'ml-5' : ''}`}>
                  <Chip>{c.tipo === 'directa' ? 'Directa' : 'Indirecta'}</Chip> {c.descripcion}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Efectos">
            <ul className="space-y-2">
              {iden?.problematica?.efectos.map((e) => (
                <li key={e.id} className={`text-sm text-gray-800 ${e.tipo === 'indirecto' ? 'ml-5' : ''}`}>
                  <Chip>{e.tipo === 'directo' ? 'Directo' : 'Indirecto'}</Chip> {e.descripcion}
                </li>
              ))}
            </ul>
          </Section>
        </div>
        <Section title="Descripción de la situación existente">
          <Text>{template.situacion_existente}</Text>
        </Section>
        <Section title="Magnitud del problema (indicadores)">
          <Text>{template.magnitud_problema}</Text>
        </Section>
      </>
    ),
    identificacion: (
      <>
        <Section title="Plan Nacional de Desarrollo (PND)">
          <Table
            head={['Transformación', 'Pilar', 'Catalizador', 'Componente']}
            rows={(f?.planDesarrollo.pnd ?? []).map((p) => [p.transformacion, p.pilar, p.catalizador, p.componente])}
          />
        </Section>
        <div className="grid gap-5 md:grid-cols-2">
          <Section title="Plan Departamental / Territorial">
            <Text>{`${f?.planDesarrollo.departamental.plan}\nEstrategia: ${f?.planDesarrollo.departamental.estrategia}\nPrograma: ${f?.planDesarrollo.departamental.programa}`}</Text>
          </Section>
          <Section title="Plan Municipal / Sectorial">
            <Text>{`${f?.planDesarrollo.municipal.plan}\nEstrategia: ${f?.planDesarrollo.municipal.estrategia}\nPrograma: ${f?.planDesarrollo.municipal.programa}`}</Text>
          </Section>
        </div>
        <Section title="Instrumentos sectoriales y enfoque étnico">
          <Text>{f?.planDesarrollo.etnias.instrumentos}</Text>
        </Section>
      </>
    ),
    participantes: (
      <Table
        head={['Participante', 'Actor', 'Posición', 'Intereses / expectativas', 'Contribución']}
        rows={participants.map((p) => [
          p.otro_participante ?? '—',
          ACTORES[p.actor_id] ?? String(p.actor_id),
          POSICIONES[p.position_id] ?? String(p.position_id),
          p.interests,
          p.contribution,
        ])}
      />
    ),
    poblacion: (
      <div className="grid gap-5 md:grid-cols-2">
        {([
          ['Población afectada', iden?.poblacion?.afectada],
          ['Población objetivo', iden?.poblacion?.objetivo],
        ] as const).map(([title, p]) => (
          <Section key={title} title={title}>
            <p className="mb-1 text-2xl font-bold text-gray-900">
              {num.format(p?.numero ?? 0)} <span className="text-sm font-normal text-gray-500">{p?.tipoPoblacion}</span>
            </p>
            <Text>{`Fuente: ${p?.fuenteInformacion ?? '—'}`}</Text>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {p?.localizaciones.map((l) => (
                <li key={l.id}>
                  {l.municipio} · {l.agrupacion}
                  {l.georeferenciada && l.latitud && l.longitud && (
                    <span className="text-gray-500"> ({l.latitud}, {l.longitud})</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        ))}
      </div>
    ),
    objetivos: (
      <>
        <Section title="Objetivo general">
          <Text>{objetivos?.objetivoGeneral}</Text>
        </Section>
        <Section title="Objetivos específicos (derivados de las causas directas)">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-800">
            {causasDirectas.map((c) => (
              <li key={c.id}>{objetivos?.objetivosEspecificos[c.id]}</li>
            ))}
          </ol>
        </Section>
        <Section title="Indicadores del objetivo general">
          <Table
            head={['Indicador', 'Unidad', 'Meta', 'Fuente de verificación']}
            rows={(objetivos?.indicadores ?? []).map((i) => [i.indicador, i.unidadMedida, i.meta, i.fuenteVerificacion])}
          />
        </Section>
      </>
    ),
    alternativas: (
      <>
        <Section title="Alternativas">
          <ul className="space-y-1 text-sm text-gray-800">
            {iden?.alternativas?.map((a) => (
              <li key={a.id}>
                <Chip>{a.estado}</Chip> {a.nombre}
              </li>
            ))}
          </ul>
        </Section>
        {productos.map(([objId, { productos: list }]) => (
          <Section key={objId} title={`Objetivo: ${objetivos?.objetivosEspecificos[objId] ?? objId}`}>
            {list.map((p) => (
              <div key={p.id} className="mb-3 rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">
                  {p.complemento} <span className="font-normal text-gray-500">· Producto MGA {p.productoId}</span>
                </p>
                <p className="mb-2 text-sm text-gray-700">{p.descripcion}</p>
                <p className="mb-2 text-xs text-gray-500">
                  Meta: {num.format(p.cantidad)} {p.unidadMedidaId} · Costo total: {cop.format(productCost(p))}
                </p>
                <Table
                  head={['Actividad', 'Insumo', 'Costo']}
                  rows={p.actividades.map((a) => [
                    a.nombre,
                    [...new Set(a.costos.map((c) => c.insumo))].join(', '),
                    cop.format(a.costos.reduce((s, c) => s + c.valor, 0)),
                  ])}
                />
              </div>
            ))}
          </Section>
        ))}
      </>
    ),
    riesgos: (
      <Table
        head={['Nivel', 'Tipo', 'Riesgo', 'Prob.', 'Impacto', 'Efectos', 'Mitigación']}
        rows={riesgos.map((r) => [
          r.nivelClasificacion,
          r.tipo,
          r.descripcion,
          r.probabilidad,
          r.impacto,
          r.efectos,
          r.medidasMitigacion,
        ])}
      />
    ),
    indicadores: (
      <>
        <Section title="Indicadores de resultado (objetivo general)">
          <Table
            head={['Indicador', 'Unidad', 'Meta']}
            rows={(objetivos?.indicadores ?? []).map((i) => [i.indicador, i.unidadMedida, i.meta])}
          />
        </Section>
        <Section title="Indicadores de producto (programación)">
          <Table
            head={['Indicador', 'Metas por período', 'Fuente']}
            rows={Object.values(f?.programacion.indicadoresProducto ?? {})
              .flat()
              .map((i) => [
                i.nombre,
                Object.entries(i.metasPeriodo)
                  .map(([p, m]) => `P${p}: ${m}`)
                  .join(' · '),
                i.detalleFuente,
              ])}
          />
        </Section>
      </>
    ),
    focalizacion: (
      <>
        <Section title="Políticas públicas y categorización poblacional">
          <Table
            head={['Política', 'Categoría', 'Indicador']}
            rows={Object.entries(f?.programacion.focalizacion?.politicasConPoblacion ?? {}).map(([pol, v]) => [
              pol,
              v.categoria,
              v.indicador,
            ])}
          />
        </Section>
        <Section title="Cruce de políticas">
          <ul className="space-y-1 text-sm text-gray-800">
            {Object.entries(f?.programacion.focalizacion?.crucesPoliticas ?? {}).map(([pol, list]) => (
              <li key={pol}>
                <strong>{pol}:</strong> {list.join(', ')}
              </li>
            ))}
          </ul>
        </Section>
      </>
    ),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-preview-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg border border-gray-100 bg-white shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Vista previa · solo lectura
            </p>
            <h3 id="template-preview-title" className="text-lg font-semibold text-gray-900">
              {template.name}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar vista previa" className="text-gray-500 hover:text-gray-800">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div role="tablist" aria-label="Secciones de la plantilla" className="flex gap-1 overflow-x-auto border-b border-gray-100 px-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tpl-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls="tpl-tabpanel"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
                tab === t.key
                  ? 'border-[#006162] text-[#006162]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div id="tpl-tabpanel" role="tabpanel" aria-labelledby={`tpl-tab-${tab}`} className="flex-1 overflow-y-auto px-6 py-5">
          {body[tab]}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-gray-300 px-5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cerrar
          </button>
          {canUse && (
            <button
              type="button"
              onClick={() => onUse(template)}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#006162] px-6 text-sm font-semibold text-white hover:bg-[#004f50]"
            >
              <Copy size={16} aria-hidden="true" />
              Usar esta Plantilla
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
