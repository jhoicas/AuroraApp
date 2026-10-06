import { describe, expect, it } from 'vitest';
import type { AdminModule } from '../../lib/accessAdminApi';
import { flattenModules, moveWithinSiblings } from './ModulesPage';

const m = (id: string, order: number, extra: Partial<AdminModule> = {}): AdminModule => ({
  id,
  code: id,
  name: id,
  kind: 'MODULE',
  scope: 'TENANT',
  route: `/${id}`,
  sort_order: order,
  is_active: true,
  is_system: false,
  customized: false,
  ...extra,
});

describe('ModulesPage helpers', () => {
  it('lista secciones bajo su módulo y respeta el orden', () => {
    const rows = flattenModules([m('b', 20), m('a', 10), m('a1', 11, { parent_id: 'a', kind: 'SECTION' })]);
    expect(rows.map((r) => [r.module.id, r.depth])).toEqual([['a', 0], ['a1', 1], ['b', 0]]);
  });

  it('intercambia el orden con el hermano', () => {
    const out = moveWithinSiblings([m('a', 10), m('b', 20)], 'b', -1);
    expect(out).toEqual([
      { id: 'b', sort_order: 10 },
      { id: 'a', sort_order: 20 },
    ]);
  });

  it('no mueve más allá de los extremos', () => {
    expect(moveWithinSiblings([m('a', 10), m('b', 20)], 'a', -1)).toEqual([]);
  });

  it('renumera cuando hay órdenes repetidos', () => {
    const out = moveWithinSiblings([m('a', 5), m('b', 5)], 'b', -1);
    expect(out).toEqual([{ id: 'a', sort_order: 6 }]);
  });
});
