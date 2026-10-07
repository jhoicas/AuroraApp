export type MgaVariable = { id: string; label: string; mock: string };
export type MgaVariableGroup = { group: string; vars: MgaVariable[] };

/** Variables MGA disponibles (ids = claves que inyecta el backend en BuildTemplateData). */
export const MGA_VARIABLE_GROUPS: MgaVariableGroup[] = [
  {
    group: 'Identificación',
    vars: [
      { id: 'project.name', label: 'Nombre del Proyecto', mock: 'Mejoramiento de la vía rural La Esperanza' },
      { id: 'project.code', label: 'Código BPIN', mock: '2024760010123' },
      { id: 'project.sector', label: 'Sector', mock: 'Transporte' },
      { id: 'project.phase', label: 'Fase de maduración', mock: 'PREFACTIBILIDAD' },
      { id: 'project.object', label: 'Objeto', mock: 'Rehabilitar 12 km de vía terciaria' },
      { id: 'tenant.name', label: 'Entidad', mock: 'Gobernación del Valle del Cauca' },
      { id: 'tenant.nit', label: 'NIT entidad', mock: '890.399.029-5' },
      { id: 'today', label: 'Fecha de generación', mock: '07/10/2026' },
    ],
  },
  {
    group: 'Problema y objetivos',
    vars: [
      { id: 'problem.description', label: 'Problema central', mock: 'Deterioro de la vía que limita el acceso a mercados.' },
      { id: 'problem.situation', label: 'Situación existente', mock: 'La vía presenta 60% de afectación.' },
      { id: 'problem.magnitude', label: 'Magnitud del problema', mock: '3.200 habitantes afectados' },
      { id: 'problem.causes', label: 'Causas', mock: '<ul><li>Falta de mantenimiento</li><li>Drenajes deficientes</li></ul>' },
      { id: 'problem.effects', label: 'Efectos', mock: '<ul><li>Mayores costos de transporte</li></ul>' },
      { id: 'objective.general', label: 'Objetivo general', mock: 'Mejorar la transitabilidad de la vía La Esperanza.' },
    ],
  },
  {
    group: 'Presupuesto',
    vars: [
      { id: 'budget.total', label: 'Total presupuesto', mock: '$ 1.250.000.000,00' },
      {
        id: 'budget.items',
        label: 'Detalle presupuesto',
        mock: '<table><tr><th>Concepto</th><th>Valor</th></tr><tr><td>Obras civiles</td><td>$ 1.000.000.000,00</td></tr><tr><td>Interventoría</td><td>$ 250.000.000,00</td></tr></table>',
      },
    ],
  },
];

const ALL_VARS = MGA_VARIABLE_GROUPS.flatMap((g) => g.vars);

/** HTML-escapa texto plano (los mocks de lista/tabla ya son HTML de confianza). */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const SPAN_RE = /<span\b[^>]*\bdata-id="([A-Za-z0-9_.]+)"[^>]*>[\s\S]*?<\/span>/gi;

/** Vista previa: reemplaza cada nodo mga-var por su dato simulado. */
export function renderPreview(html: string): string {
  return html.replace(SPAN_RE, (full, id: string) => {
    if (!/\bmga-var\b/.test(full)) return full;
    const v = ALL_VARS.find((x) => x.id === id);
    if (!v) return '';
    return v.mock.startsWith('<') ? v.mock : esc(v.mock);
  });
}
