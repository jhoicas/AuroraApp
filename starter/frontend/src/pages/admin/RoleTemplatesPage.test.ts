import { describe, expect, it } from 'vitest';
import { draftToModules, toggleFlag } from './RoleTemplatesPage';

const none = { can_view: false, can_create: false, can_edit: false, can_delete: false };

describe('RoleTemplatesPage helpers', () => {
  it('marcar escribir marca ver', () => {
    expect(toggleFlag(none, 'edit', true)).toEqual({ ...none, can_view: true, can_edit: true });
  });

  it('quitar ver limpia todo', () => {
    expect(toggleFlag({ can_view: true, can_create: true, can_edit: true, can_delete: true }, 'view', false)).toEqual(none);
  });

  it('quitar una acción de escritura conserva ver', () => {
    const f = toggleFlag({ ...none, can_view: true, can_create: true }, 'create', false);
    expect(f).toEqual({ ...none, can_view: true });
  });

  it('draftToModules omite los módulos sin permisos', () => {
    expect(draftToModules({ a: none, b: { ...none, can_view: true } })).toEqual({ b: { ...none, can_view: true } });
  });
});
