import { useEffect, useMemo } from 'react';
import { useProjectStore, type Project } from '../store/projectStore';
import { useLocationStore } from '../store/locationStore';
import { resolveProjectBaseLocation, type ProjectBaseLocation } from './projectBaseLocation';

export type ProjectBaseLocationInfo = {
  /** null: el proyecto no tiene departamento base registrado (no hay restricción que aplicar). */
  base: ProjectBaseLocation | null;
  regionName: string | null;
  departamentoName: string | null;
};

const NO_BASE: ProjectBaseLocationInfo = { base: null, regionName: null, departamentoName: null };

/**
 * Localización base del proyecto con nombres legibles. Si la región no viene en el proyecto,
 * se deduce del catálogo jerárquico (región → departamento → municipio).
 */
export function useProjectBaseLocation(project: Project): ProjectBaseLocationInfo {
  const currentProject = useProjectStore((s) => s.currentProject);
  const regions = useLocationStore((s) => s.regions);
  const fetchLocations = useLocationStore((s) => s.fetchLocations);

  const raw = useMemo(
    () => resolveProjectBaseLocation(currentProject?.id === project.id ? currentProject : null, project),
    [currentProject, project],
  );
  const baseDepartamentoId = raw?.departamentoId ?? null;

  // El catálogo solo se pide cuando hay base y aún no está en memoria (fetchLocations cachea).
  useEffect(() => {
    if (baseDepartamentoId !== null && regions.length === 0) void fetchLocations();
  }, [baseDepartamentoId, regions.length, fetchLocations]);

  return useMemo(() => {
    if (!raw) return NO_BASE;

    let regionId = raw.regionId;
    let departamentoName: string | null = null;
    for (const region of regions) {
      const dep = region.departamentos?.find((d) => d.id === raw.departamentoId);
      if (dep) {
        departamentoName = dep.name;
        regionId = regionId ?? region.id;
        break;
      }
    }
    const regionName = regionId !== null ? (regions.find((r) => r.id === regionId)?.name ?? null) : null;

    return { base: { ...raw, regionId }, regionName, departamentoName };
  }, [raw, regions]);
}
