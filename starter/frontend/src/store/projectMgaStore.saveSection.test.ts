import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectMgaStore } from './projectMgaStore';
import { useProjectStore } from './projectStore';

describe('saveAndCompleteSection', () => {
  beforeEach(() => useProjectMgaStore.setState({ byProjectId: {} }));

  it('marca la sección completada solo tras respuesta exitosa', async () => {
    const patch = vi.fn().mockResolvedValue({});
    useProjectStore.setState({ patchProject: patch } as never);
    await useProjectMgaStore.getState().saveAndCompleteSection('p1', 'necesidades');
    expect(patch).toHaveBeenCalledTimes(1);
    expect(useProjectMgaStore.getState().getFormulation('p1').completedSections.necesidades).toBe(true);
  });

  it('no marca completitud si la API falla', async () => {
    useProjectStore.setState({ patchProject: vi.fn().mockRejectedValue(new Error('boom')) } as never);
    await expect(useProjectMgaStore.getState().saveAndCompleteSection('p2', 'necesidades')).rejects.toThrow('boom');
    expect(useProjectMgaStore.getState().getFormulation('p2').completedSections?.necesidades).toBeUndefined();
    expect(useProjectMgaStore.getState().error).toBe('boom');
  });
});
