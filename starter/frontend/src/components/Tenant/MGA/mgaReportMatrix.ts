import type { ProjectActivity, ProjectDeliverable } from '../../../lib/projectEdtApi';
import type {
  CauseObjectiveRelation,
  GeneralObjectiveIndicator,
  ProjectMgaFormulation,
} from '../../../store/projectMgaStore';
import type { ProjectEdtChainState } from '../../../store/projectEdtStore';

export type MgaLogicMatrixRow = {
  id: string;
  level: 'objective' | 'product' | 'activity';
  hierarchyLabel: string;
  narrative: string;
  indicators: string;
  verificationSources: string;
  assumptions: string;
};

function joinLines(items: string[]): string {
  const filtered = items.map((item) => item.trim()).filter(Boolean);
  return filtered.length > 0 ? filtered.join('\n') : '—';
}

function formatGeneralIndicators(indicators: GeneralObjectiveIndicator[]): {
  indicators: string;
  verificationSources: string;
  assumptions: string;
} {
  if (indicators.length === 0) {
    return { indicators: '—', verificationSources: '—', assumptions: '—' };
  }

  return {
    indicators: joinLines(
      indicators.map((ind) => `${ind.indicator} — Meta: ${ind.target} (${ind.measuredThrough})`),
    ),
    verificationSources: joinLines(indicators.map((ind) => ind.verificationSource)),
    assumptions: joinLines(indicators.map((ind) => ind.sourceType)),
  };
}

function formatSpecificObjectiveIndicators(
  relations: CauseObjectiveRelation[],
): { indicators: string; verificationSources: string } {
  const objectives = relations
    .map((rel) => rel.specificObjective.trim())
    .filter(Boolean);
  return {
    indicators: objectives.length > 0 ? joinLines(objectives) : '—',
    verificationSources: '—',
  };
}

export function buildMgaLogicMatrix(params: {
  generalObjective: string;
  formulation: ProjectMgaFormulation;
  edtChain: ProjectEdtChainState;
}): MgaLogicMatrixRow[] {
  const rows: MgaLogicMatrixRow[] = [];
  const general = formatGeneralIndicators(params.formulation.generalIndicators);
  const specific = formatSpecificObjectiveIndicators(params.formulation.causeRelations);

  rows.push({
    id: 'general-objective',
    level: 'objective',
    hierarchyLabel: 'Objetivo general',
    narrative: params.generalObjective.trim() || '—',
    indicators: general.indicators !== '—' ? general.indicators : specific.indicators,
    verificationSources: general.verificationSources,
    assumptions: general.assumptions,
  });

  const deliverables = [...params.edtChain.deliverables].sort((a, b) =>
    a.code.localeCompare(b.code),
  );
  const activitiesByDeliverable = new Map<string, ProjectActivity[]>();

  for (const activity of params.edtChain.activities) {
    const list = activitiesByDeliverable.get(activity.project_deliverable_id) ?? [];
    list.push(activity);
    activitiesByDeliverable.set(activity.project_deliverable_id, list);
  }

  if (deliverables.length === 0) {
    rows.push({
      id: 'no-products',
      level: 'product',
      hierarchyLabel: 'Producto / componente',
      narrative: 'No hay productos o entregables registrados en la cadena de valor.',
      indicators: '—',
      verificationSources: '—',
      assumptions: '—',
    });
    return rows;
  }

  for (const deliverable of deliverables) {
    rows.push(mapDeliverableRow(deliverable));

    const activities = (activitiesByDeliverable.get(deliverable.id) ?? []).sort((a, b) =>
      a.code.localeCompare(b.code),
    );

    if (activities.length === 0) {
      rows.push({
        id: `${deliverable.id}-no-activities`,
        level: 'activity',
        hierarchyLabel: 'Actividad',
        narrative: 'Sin actividades asociadas a este producto.',
        indicators: '—',
        verificationSources: '—',
        assumptions: '—',
      });
      continue;
    }

    for (const activity of activities) {
      rows.push(mapActivityRow(activity, deliverable));
    }
  }

  return rows;
}

function mapDeliverableRow(deliverable: ProjectDeliverable): MgaLogicMatrixRow {
  return {
    id: deliverable.id,
    level: 'product',
    hierarchyLabel: `Producto ${deliverable.code}`,
    narrative: deliverable.name.trim() || '—',
    indicators: '—',
    verificationSources: '—',
    assumptions: '—',
  };
}

function mapActivityRow(
  activity: ProjectActivity,
  deliverable: ProjectDeliverable,
): MgaLogicMatrixRow {
  const unitLabel = activity.quantity === 1 ? 'unidad' : 'unidades';
  return {
    id: activity.id,
    level: 'activity',
    hierarchyLabel: `Actividad ${activity.code}`,
    narrative: `${activity.name.trim() || '—'} (Producto ${deliverable.code})`,
    indicators: `Meta: ${activity.quantity} ${unitLabel}`,
    verificationSources: '—',
    assumptions: '—',
  };
}
