import { useState, useEffect, useRef, useMemo } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore, type CadenaValorData } from '../../../store/projectMgaStore';
import { useCatalogStore, CATALOG_FULL_LIST_LIMIT } from '../../../store/catalogStore';
import MgaAlert from './MgaAlert';
import type { ProjectContext } from '../../../data/mgaFieldsKnowledge';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

type CadenaValorTabProps = {
  project: Project;
};

export default function CadenaValorTab({ project }: CadenaValorTabProps) {
  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const saveCadenaDeValor = useProjectMgaStore((s) => s.saveCadenaDeValor);

  // Catalog selectors
  const sectors = useCatalogStore((s) => s.sectors);
  const programs = useCatalogStore((s) => s.programs);
  const catalogProducts = useCatalogStore((s) => s.catalogProducts);
  const catalogEdt = useCatalogStore((s) => s.catalogEdt);

  const fetchSectors = useCatalogStore((s) => s.fetchSectors);
  const fetchProgramsBySector = useCatalogStore((s) => s.fetchProgramsBySector);
  const fetchCatalogProducts = useCatalogStore((s) => s.fetchCatalogProducts);
  const fetchCatalogEdt = useCatalogStore((s) => s.fetchCatalogEdt);

  const isLoadingSectors = useCatalogStore((s) => s.isLoading);
  const isLoadingPrograms = useCatalogStore((s) => s.isLoadingSectorPrograms);
  const isLoadingProducts = useCatalogStore((s) => s.isLoadingProducts);
  const isLoadingEdt = useCatalogStore((s) => s.isLoadingEdt);

  const clearPrograms = useCatalogStore((s) => s.clearPrograms);
  const clearProducts = useCatalogStore((s) => s.clearProducts);
  const clearEdt = useCatalogStore((s) => s.clearEdt);

  const initialData = getFormulation(project.id)?.cadenaValor;

  const [sectorCode, setSectorCode] = useState(initialData?.sectorCode || '');
  const [programaCode, setProgramaCode] = useState(initialData?.programaCode || '');
  const [productoCode, setProductoCode] = useState(initialData?.productoCode || '');
  const [edtId, setEdtId] = useState(initialData?.edtId || '');

  const [error, setError] = useState<string | null>(null);

  const prevProjectIdRef = useRef(project.id);
  const isFirstMount = useRef(true);
  
  const lastSavedRef = useRef<string>(JSON.stringify({
    sectorCode: initialData?.sectorCode || '',
    programaCode: initialData?.programaCode || '',
    productoCode: initialData?.productoCode || '',
    edtId: initialData?.edtId || '',
  }));

  const fieldProjectContext: ProjectContext = useMemo(() => ({
    projectName: project.name,
    sector: project.sector || undefined,
    productCode: project.product_code || undefined,
    procesoName: (project as any)?.proceso_id ? String((project as any)?.proceso_id) : undefined,
    objeto: (project as any)?.objeto || undefined,
  }), [project]);

  // Initial load of Sectors
  useEffect(() => {
    if (sectors.length === 0) {
      void fetchSectors({ page: 1, limit: CATALOG_FULL_LIST_LIMIT });
    }
  }, [sectors.length, fetchSectors]);

  // Initial load of dependent catalogs if data exists
  useEffect(() => {
    if (initialData?.sectorCode) {
      void fetchProgramsBySector(initialData.sectorCode);
    }
    if (initialData?.programaCode) {
      void fetchCatalogProducts({ search: initialData.programaCode });
    }
    if (initialData?.productoCode) {
      void fetchCatalogEdt({ search: initialData.productoCode, limit: CATALOG_FULL_LIST_LIMIT });
    }
  }, []); // Run only on mount

  // Sync state if project changes
  useEffect(() => {
    if (prevProjectIdRef.current !== project.id) {
      prevProjectIdRef.current = project.id;
      const currentData = useProjectMgaStore.getState().getFormulation(project.id)?.cadenaValor;
      setSectorCode(currentData?.sectorCode || '');
      setProgramaCode(currentData?.programaCode || '');
      setProductoCode(currentData?.productoCode || '');
      setEdtId(currentData?.edtId || '');
      
      lastSavedRef.current = JSON.stringify({
        sectorCode: currentData?.sectorCode || '',
        programaCode: currentData?.programaCode || '',
        productoCode: currentData?.productoCode || '',
        edtId: currentData?.edtId || '',
      });
      
      if (currentData?.sectorCode) void fetchProgramsBySector(currentData.sectorCode);
      if (currentData?.programaCode) void fetchCatalogProducts({ search: currentData.programaCode });
      if (currentData?.productoCode) void fetchCatalogEdt({ search: currentData.productoCode, limit: CATALOG_FULL_LIST_LIMIT });
    }
  }, [project.id, fetchProgramsBySector, fetchCatalogProducts, fetchCatalogEdt]);

  // Auto-save effect
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const data: CadenaValorData = {
      sectorCode,
      programaCode,
      productoCode,
      edtId,
    };

    const serialized = JSON.stringify(data);
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;

    void saveCadenaDeValor(project.id, data);
  }, [sectorCode, programaCode, productoCode, edtId, project.id, saveCadenaDeValor]);

  const handleSectorChange = (val: string) => {
    setSectorCode(val);
    setProgramaCode('');
    setProductoCode('');
    setEdtId('');
    clearPrograms();
    clearProducts();
    clearEdt();
    if (val) void fetchProgramsBySector(val);
  };

  const handleProgramChange = (val: string) => {
    setProgramaCode(val);
    setProductoCode('');
    setEdtId('');
    clearProducts();
    clearEdt();
    if (val) void fetchCatalogProducts({ search: val });
  };

  const handleProductChange = (val: string) => {
    setProductoCode(val);
    setEdtId('');
    clearEdt();
    if (val) void fetchCatalogEdt({ search: val, limit: CATALOG_FULL_LIST_LIMIT });
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Cadena de Valor</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}

      <div className="space-y-6">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
          <AIAssistedField label="Sector" projectContext={fieldProjectContext}>
            <select
              value={sectorCode}
              onChange={(e) => handleSectorChange(e.target.value)}
              disabled={isLoadingSectors}
              className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#006162] outline-none"
            >
              <option value="">Seleccione un sector...</option>
              {sectors.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
            </select>
          </AIAssistedField>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
          <AIAssistedField label="Programa" projectContext={fieldProjectContext}>
            <select
              value={programaCode}
              onChange={(e) => handleProgramChange(e.target.value)}
              disabled={!sectorCode || isLoadingPrograms}
              className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#006162] outline-none"
            >
              <option value="">Seleccione un programa...</option>
              {programs.map(p => <option key={p.code} value={p.code}>{p.code} - {p.name}</option>)}
            </select>
          </AIAssistedField>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
          <AIAssistedField label="Producto" projectContext={fieldProjectContext}>
            <select
              value={productoCode}
              onChange={(e) => handleProductChange(e.target.value)}
              disabled={!programaCode || isLoadingProducts}
              className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#006162] outline-none"
            >
              <option value="">Seleccione un producto...</option>
              {catalogProducts.map(p => <option key={p.codigo_del_producto} value={p.codigo_del_producto}>{p.codigo_del_producto} - {p.producto}</option>)}
            </select>
          </AIAssistedField>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
          <AIAssistedField label="EDT / Actividad" projectContext={fieldProjectContext}>
            <select
              value={edtId}
              onChange={(e) => setEdtId(e.target.value)}
              disabled={!productoCode || isLoadingEdt}
              className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-[#006162] outline-none"
            >
              <option value="">Seleccione un EDT...</option>
              {catalogEdt.map(e => <option key={e.id} value={e.id}>{e.codigo_actividad} - {e.actividad}</option>)}
            </select>
          </AIAssistedField>
        </div>
      </div>
    </div>
  );
}
