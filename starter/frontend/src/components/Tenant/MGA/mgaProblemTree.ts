import type { MgaEffect } from '../../../lib/mgaApi';
import type { CauseObjectiveRelation } from '../../../store/projectMgaStore';

export type ParentChildGroup<T> = {
  parent: T;
  children: T[];
};

function sortByOrder<T extends { sort_order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function groupEffectsByParent(effects: MgaEffect[]): ParentChildGroup<MgaEffect>[] {
  const directParents = sortByOrder(
    effects.filter((effect) => effect.effect_type === 'directo' && !effect.parent_id),
  );

  const groups = directParents.map((parent) => ({
    parent,
    children: sortByOrder(effects.filter((effect) => effect.parent_id === parent.id)),
  }));

  const orphanIndirects = sortByOrder(
    effects.filter(
      (effect) =>
        effect.effect_type === 'indirecto' &&
        (!effect.parent_id || !directParents.some((direct) => direct.id === effect.parent_id)),
    ),
  );

  if (orphanIndirects.length === 0) {
    return groups;
  }

  if (groups.length === 0) {
    return orphanIndirects.map((effect) => ({ parent: effect, children: [] }));
  }

  const lastGroup = groups[groups.length - 1];
  lastGroup.children = sortByOrder([...lastGroup.children, ...orphanIndirects]);
  return groups;
}

export function groupCausesByParent(
  relations: CauseObjectiveRelation[],
): ParentChildGroup<CauseObjectiveRelation>[] {
  const directParents = relations.filter(
    (relation) => relation.causeType === 'Causa directa' && !relation.parentId,
  );

  const groups = directParents.map((parent) => ({
    parent,
    children: relations.filter((relation) => relation.parentId === parent.id),
  }));

  const orphanIndirects = relations.filter(
    (relation) =>
      relation.causeType === 'Causa indirecta' &&
      (!relation.parentId || !directParents.some((direct) => direct.id === relation.parentId)),
  );

  if (orphanIndirects.length === 0) {
    return groups;
  }

  if (groups.length === 0) {
    return orphanIndirects.map((relation) => ({ parent: relation, children: [] }));
  }

  const lastGroup = groups[groups.length - 1];
  lastGroup.children = [...lastGroup.children, ...orphanIndirects];
  return groups;
}
