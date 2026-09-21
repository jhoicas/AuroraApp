import { type FormEvent, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AIAssistedField from '../AuroraAsistente/AIAssistedField';
import SearchableCombobox, { type ComboboxOption } from '../Catalog/SearchableCombobox';
import ProductDetailModal from './ProductDetailModal';

import { useProjectStore } from '../../store/projectStore';
import { useAuroraCopilotStore } from '../../store/auroraCopilotStore';
import {
  useLocationStore,
  generateProjectName,
  type LocationSelection,
} from '../../store/locationStore';
import {
  CATALOG_FULL_LIST_LIMIT,
  useCatalogStore,
  type CatalogSector,
  type Product,
} from '../../store/catalogStore';
import type { ProjectContext } from '../../data/mgaFieldsKnowledge';

type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
  editProject?: import('../../store/projectStore').Project;
};

// ─── Constantes MGA ────────────────────────────────────────────────

const TIPOS_INVERSION = [
  { value: 'Territorial', label: 'Territorial', disabled: false },
  { value: 'Nacional', label: 'Nacional', disabled: true },
] as const;

const TIPOLOGIAS_PROYECTO = [
  "General - Esquemas SUIFP's",
  "E - Esquemas SUIFP's - Pueblos y comunidades étnicas",
  'A - PIIP - Bienes y Servicios',
  'E - PIIP - Pueblos y Comunidades Indígenas',
] as const;

const EMPTY_LOCATION: LocationSelection = {
  regionId: null,
  departamentoId: null,
  municipioId: null,
};

// ─── Componente principal ──────────────────────────────────────────

export default function CreateProjectModal({ open, onClose, editProject }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const createProject = useProjectStore((s) => s.createProject);
  const patchProject = useProjectStore((s) => s.patchProject);
  const patchCurrentProject = useProjectStore((s) => s.patchCurrentProject);
  const isLoading = useProjectStore((s) => s.isLoading);

  const {
    projectSuggestions,
    preCreationContext,
    clearChat,
    ideationMessages,
    ideationComplete,
    ideationLoading,
    sendIdeationMessage,
    resetIdeation,
    suggestProjectSetup,
  } = useAuroraCopilotStore();

  const [step, setStep] = useState<'wizard' | 'form'>(editProject ? 'form' : 'wizard');
  const [ideationInput, setIdeationInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ideationMessages]);

  useEffect(() => {
    if (ideationComplete && step === 'wizard') {
      setStep('form');
    }
  }, [ideationComplete, step]);

  // Stores externos
  const regions = useLocationStore((s) => s.regions);
  const procesos = useLocationStore((s) => s.procesos);
  const fetchLocations = useLocationStore((s) => s.fetchLocations);
  const fetchProcesos = useLocationStore((s) => s.fetchProcesos);

  const sectors = useCatalogStore((s) => s.sectors);
  const fetchSectors = useCatalogStore((s) => s.fetchSectors);
  const catalogProducts = useCatalogStore((s) => s.catalogProducts);
  const isLoadingProducts = useCatalogStore((s) => s.isLoadingProducts);
  const fetchCatalogProducts = useCatalogStore((s) => s.fetchCatalogProducts);

  // ─── Estado del formulario ──────────────────
  const [proceso, setProceso] = useState(editProject?.mga_formulation_data?.proceso_id ? String(editProject.mga_formulation_data.proceso_id) : '');
  const [objeto, setObjeto] = useState(editProject?.mga_formulation_data?.objeto ?? '');
  const [localizaciones, setLocalizaciones] = useState<LocationSelection[]>(
    editProject?.mga_formulation_data?.localizaciones?.length 
      ? editProject.mga_formulation_data.localizaciones 
      : [{ ...EMPTY_LOCATION }]
  );
  const [tipoInversion, setTipoInversion] = useState(editProject?.mga_formulation_data?.tipo_inversion ?? 'Territorial');
  const [tipologiaProyecto, setTipologiaProyecto] = useState(editProject?.mga_formulation_data?.tipologia ?? '');
  const [sectorId, setSectorId] = useState(editProject?.sector_id ?? '');
  const [productoPrincipal, setProductoPrincipal] = useState(editProject?.product_code ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  
  useEffect(() => {
    if (open) {
      if (editProject) {
        console.log("[CreateProjectModal] open:", open, "editProject:", editProject);

        // Soporte dual para snake_case y camelCase
        let rawMga: any = editProject.mga_formulation_data || (editProject as any).mgaFormulationData || {};
        if (typeof rawMga === 'string') {
          try {
            rawMga = JSON.parse(rawMga);
          } catch (e) {
            rawMga = {};
          }
        }

        const identificacion = rawMga?.identificacion || rawMga?.PlanDesarrollo || {};

        const foundProceso = identificacion.proceso || rawMga?.proceso || (editProject as any).proceso || (editProject as any).proceso_id || '';
        setProceso(foundProceso ? String(foundProceso) : '');
        
        setObjeto(editProject.description || '');
        
        const rawLocations = rawMga?.localizaciones || identificacion.localizaciones || (editProject as any).locations || (editProject as any).localizaciones || [];
        setLocalizaciones(Array.isArray(rawLocations) && rawLocations.length > 0 ? rawLocations : [{ ...EMPTY_LOCATION }]);
        
        setTipoInversion(rawMga?.tipo_inversion ?? 'Territorial');
        setTipologiaProyecto(identificacion.tipologia || rawMga?.tipologia || '');
        
        const foundSector = editProject.sector_id || (editProject as any).sectorId || identificacion.sector_id || '';
        setSectorId(foundSector ? String(foundSector) : '');
        
        const foundProduct = editProject.product_code || (editProject as any).productCode || '';
        setProductoPrincipal(foundProduct ? String(foundProduct) : '');
      } else {
        setProceso('');
        setObjeto('');
        setLocalizaciones([{ ...EMPTY_LOCATION }]);
        setTipoInversion('Territorial');
        setTipologiaProyecto('');
        setSectorId('');
        setProductoPrincipal('');
      }
      
      if (!editProject) {
        setStep('wizard');
        resetIdeation();
        setIdeationInput('');
        // Enviar un mensaje inicial automático para que el LLM arranque la entrevista
        setTimeout(() => {
          void sendIdeationMessage('Hola Aurora, quiero estructurar un nuevo proyecto de inversión pública.');
        }, 100);
      } else {
        setStep('form');
      }
    }
  }, [editProject, open]);

  useEffect(() => {
    if (projectSuggestions && !editProject) {
      setTipoInversion('Territorial');
      setTipologiaProyecto('A - PIIP - Bienes y Servicios');
    }
  }, [projectSuggestions, editProject]);

  // Reactividad: refrescar sugerencias cuando el usuario edita el formulario
  useEffect(() => {
    if (step !== 'form') return;
    
    const handler = setTimeout(() => {
      // Mapear localizaciones al formato de texto esperado para mayor claridad al LLM
      const locNames = localizaciones.map(l => {
        const r = regions.find(r => r.id === l.regionId);
        const d = r?.departamentos.find(d => d.id === l.departamentoId);
        const m = d?.municipios.find(m => m.id === l.municipioId);
        return {
          departamento: d?.name || '',
          municipio: m?.name || '',
        };
      }).filter(l => l.departamento || l.municipio);

      const pName = procesos.find(p => String(p.id) === proceso)?.name || '';
      const sName = sectors.find(s => s.id === sectorId)?.name || '';
      const prodName = catalogProducts.find(p => p.codigo_del_producto === productoPrincipal)?.producto || '';

      const currentFormData = {
        proceso: pName,
        objeto,
        localizaciones: locNames,
        sector: sName,
        producto: prodName,
      };

      // Limpiar campos vacíos
      Object.keys(currentFormData).forEach(key => {
        const v = (currentFormData as any)[key];
        if (!v || (Array.isArray(v) && v.length === 0)) {
          delete (currentFormData as any)[key];
        }
      });

      if (Object.keys(currentFormData).length > 0) {
        void suggestProjectSetup(currentFormData);
      }
    }, 1000);

    return () => clearTimeout(handler);
  }, [proceso, objeto, localizaciones, sectorId, productoPrincipal, step, regions, procesos, sectors, catalogProducts, suggestProjectSetup]);
  
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  // ─── Sectores filtrados por tipología ──────────────────
  const filteredSectors = useMemo(() => {
    if (tipologiaProyecto === 'A - PIIP - Bienes y Servicios') {
      return sectors.filter(
        (s) => s.application && s.application.toUpperCase().includes('TERRITORIO'),
      );
    }
    return sectors;
  }, [sectors, tipologiaProyecto]);

  const [selectedProductData, setSelectedProductData] = useState<Product | null>(null);

  // ─── Combobox Options ──────────────────
  const procesoOptions: ComboboxOption[] = useMemo(
    () => procesos.map((p) => ({ value: String(p.id), label: p.name, code: String(p.id) })),
    [procesos]
  );

  const sectorOptions: ComboboxOption[] = useMemo(
    () => filteredSectors.map((s) => ({ value: s.id, label: s.name, code: s.code })),
    [filteredSectors]
  );

  const productOptions: ComboboxOption[] = useMemo(
    () => catalogProducts.map((p) => ({
      value: p.codigo_del_producto,
      label: p.producto.trim(),
      code: p.codigo_del_producto.trim(),
      indicatorCode: p.codigo_del_indicador_de_producto.trim(),
      indicatorLabel: p.indicador_de_producto.trim(),
      hint: Object.values(p).filter(v => v !== null && v !== undefined && v !== '').join(" ").trim()
    })),
    [catalogProducts]
  );

  // ─── Cargar datos al abrir ──────────────────
  useEffect(() => {
    if (!open) return;
    void fetchLocations();
    void fetchProcesos();
    void fetchSectors({ page: 1, limit: CATALOG_FULL_LIST_LIMIT });
  }, [open, fetchLocations, fetchProcesos, fetchSectors]);

  // ─── Cargar Productos por Sector ──────────────────
  useEffect(() => {
    if (sectorId) {
      const selectedSector = sectors.find((s) => s.id === sectorId);
      if (selectedSector?.code) {
        void fetchCatalogProducts({
          page: 1,
          limit: CATALOG_FULL_LIST_LIMIT,
          search: selectedSector.code,
        });
      }
    }
  }, [sectorId, sectors, fetchCatalogProducts]);

  // ─── Nombre auto-generado ──────────────────
  const procesoName = useMemo(
    () => procesos.find((p) => String(p.id) === proceso)?.name ?? '',
    [procesos, proceso],
  );

  const generatedName = useMemo(
    () => generateProjectName(procesoName, objeto, localizaciones, regions),
    [procesoName, objeto, localizaciones, regions],
  );

  // ─── Productos del sector seleccionado ──────────────────
  const selectedSector: CatalogSector | undefined = useMemo(
    () => sectors.find((s) => s.id === sectorId),
    [sectors, sectorId],
  );

  const fieldProjectContext: ProjectContext = useMemo(() => {
    const mainRegion = localizaciones[0]?.regionId ? regions.find(r => r.id === localizaciones[0].regionId) : undefined;
    const mainDep = mainRegion && localizaciones[0]?.departamentoId ? mainRegion.departamentos.find(d => d.id === localizaciones[0].departamentoId) : undefined;
    const mainMun = mainDep && localizaciones[0]?.municipioId ? mainDep.municipios.find(m => m.id === localizaciones[0].municipioId) : undefined;
    
    return {
      projectName: generatedName,
      procesoName: procesoName,
      objeto: objeto,
      sector: selectedSector?.name,
      productCode: productoPrincipal,
      productName: ((selectedProductData as any)?.nombre_producto || (selectedProductData as any)?.nombre || (selectedProductData as any)?.name || ''),
      departamento: mainDep?.name,
      municipio: mainMun?.name,
    };
  }, [generatedName, procesoName, objeto, selectedSector, productoPrincipal, selectedProductData, localizaciones, regions]);

  useEffect(() => {
    if (!sectorId || !selectedSector) {
      if (!editProject) setProductoPrincipal('');
      return;
    }
    void fetchCatalogProducts({
      page: 1,
      limit: CATALOG_FULL_LIST_LIMIT,
      search: selectedSector.code,
    });
  }, [sectorId, selectedSector, fetchCatalogProducts]);

  // ─── Handlers de localización ──────────────────
  const updateLocation = useCallback(
    (index: number, field: keyof LocationSelection, value: number | null) => {
      setLocalizaciones((prev) => {
        const copy = [...prev];
        const item = { ...copy[index] };
        item[field] = value;
        // Limpiar niveles inferiores al cambiar un superior
        if (field === 'regionId') {
          item.departamentoId = null;
          item.municipioId = null;
        }
        if (field === 'departamentoId') {
          item.municipioId = null;
        }
        copy[index] = item;
        return copy;
      });
    },
    [],
  );

  const addLocation = useCallback(() => {
    setLocalizaciones((prev) => [...prev, { ...EMPTY_LOCATION }]);
  }, []);

  const removeLocation = useCallback((index: number) => {
    setLocalizaciones((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Helpers de resolución ──────────────────
  const getDepartamentos = useCallback(
    (regionId: number | null) => {
      if (regionId === null) return [];
      return regions.find((r) => r.id === regionId)?.departamentos ?? [];
    },
    [regions],
  );

  const getMunicipios = useCallback(
    (regionId: number | null, depId: number | null) => {
      if (regionId === null || depId === null) return [];
      const dep = regions
        .find((r) => r.id === regionId)
        ?.departamentos.find((d) => d.id === depId);
      return dep?.municipios ?? [];
    },
    [regions],
  );

  // ─── Reset ──────────────────
  const reset = () => {
    if (!editProject) {
      setProceso('');
      setObjeto('');
      setLocalizaciones([{ ...EMPTY_LOCATION }]);
      setTipoInversion('Territorial');
      setTipologiaProyecto('');
      setSectorId('');
      setProductoPrincipal('');
    }
    setFormError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTipologiaChange = (value: string) => {
    setTipologiaProyecto(value);
    // Si cambió la tipología, verificar que el sector sigue siendo válido
    setSectorId('');
    setProductoPrincipal('');
  };

  // ─── Submit ──────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!proceso) {
      setFormError('El proceso es obligatorio.');
      return;
    }
    if (objeto.trim().length < 10) {
      setFormError('El objeto del proyecto debe contener al menos 10 caracteres.');
      return;
    }
    if (localizaciones.length === 0 || !localizaciones.some(l => l.regionId)) {
      setFormError('Debe seleccionar al menos una localización con su respectiva región.');
      return;
    }
    if (!tipologiaProyecto) {
      setFormError('La tipología de proyecto es obligatoria.');
      return;
    }
    if (!sectorId) {
      setFormError('Selecciona un sector.');
      return;
    }
    if (!productoPrincipal) {
      setFormError('El producto principal es obligatorio.');
      return;
    }

    try {
      if (editProject) {
        // Modo Edición
        const idenPayload = {
          proceso_id: parseInt(proceso, 10),
          proceso: parseInt(proceso, 10),
          objeto: objeto.trim(),
          localizaciones: localizaciones,
          tipo_inversion: tipoInversion,
          tipologia: tipologiaProyecto,
        };

        const currentProject = useProjectStore.getState().currentProject;
        const currentMgaData = currentProject?.mga_formulation_data || {};
        const currentIden = currentMgaData.identificacion || {};

        // Parcheamos el estado local de forma síncrona
        patchCurrentProject({ 
          name: generatedName, 
          description: objeto.trim(),
          sector: selectedSector?.name ?? '', 
          sector_id: sectorId, 
          product_code: productoPrincipal || undefined,
          mga_formulation_data: {
            ...currentMgaData,
            identificacion: {
              ...currentIden,
              ...idenPayload
            }
          }
        });
        
        // Hacemos el PATCH al backend. Los datos de MGA van en mga_formulation_data.identificacion
        await patchProject(editProject.id, {
          name: generatedName,
          description: objeto.trim(),
          sector: selectedSector?.name ?? '',
          sector_id: sectorId,
          product_code: productoPrincipal || undefined,
          mga_formulation_data: {
            ...currentMgaData,
            identificacion: {
              ...currentIden,
              ...idenPayload
            }
          }
        });
        
        // Limpiamos el chat para que el contexto copilot se refresque
        clearChat();
        
        handleClose();
      } else {
        // Modo Creación
        const project = await createProject({
          name: generatedName,
          description: objeto.trim(),
          sector: selectedSector?.name ?? '',
          sector_id: sectorId,
          product_code: productoPrincipal || undefined,
          proceso_id: parseInt(proceso, 10),
          objeto: objeto.trim(),
          localizaciones: localizaciones,
          tipo_inversion: tipoInversion,
          tipologia: tipologiaProyecto,
          mga_formulation_data: {
            identificacion: {
              contexto_inicial: preCreationContext,
              proceso: parseInt(proceso, 10),
              proceso_id: parseInt(proceso, 10),
              objeto: objeto.trim(),
              localizaciones: localizaciones,
              tipo_inversion: tipoInversion,
              tipologia: tipologiaProyecto,
            }
          }
        } as any);
        handleClose();
        navigate(`/tenant/projects/${project.id}/plan-desarrollo`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear el proyecto');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-lg border border-gray-100"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white z-10">
          <h3 id="create-project-title" className="text-lg font-semibold text-gray-800">
            {editProject ? 'Editar datos del proyecto MGA' : step === 'wizard' ? 'Aurora: Asistente de ideación' : 'Nuevo proyecto MGA'}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {step === 'wizard' ? (
          <div className="px-6 py-6 flex flex-col h-[60vh]">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
              {ideationMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-[#006162] text-white rounded-br-none'
                        : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1 mb-1 opacity-70 text-xs font-semibold">
                        <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                        Aurora
                      </div>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {ideationLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-bl-none px-4 py-3 text-sm border border-slate-200 flex items-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                    Aurora está escribiendo...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100 relative flex items-center">
              <input spellCheck={true}
                type="text"
                className="w-full rounded-full border-gray-300 shadow-sm focus:border-[#006162] focus:ring-[#006162] text-sm py-3 pl-4 pr-12"
                placeholder="Escribe tu respuesta..."
                value={ideationInput}
                onChange={(e) => setIdeationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !ideationLoading && ideationInput.trim()) {
                    e.preventDefault();
                    void sendIdeationMessage(ideationInput);
                    setIdeationInput('');
                  }
                }}
                disabled={ideationLoading}
              />
              <button
                type="button"
                disabled={ideationLoading || !ideationInput.trim()}
                onClick={() => {
                  void sendIdeationMessage(ideationInput);
                  setIdeationInput('');
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-[#006162] text-white disabled:opacity-50 disabled:bg-gray-400 hover:bg-[#004d40] transition-colors"
              >
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* ── Nombre auto-generado (readonly) ── */}
          <AIAssistedField
            label="Nombre del proyecto"
            htmlFor="project-generated-name"
            guidance="El nombre del proyecto MGA se auto-genera para garantizar la estructura normativa: Proceso + Objeto + Localización."
            askPrompt="¿Por qué el nombre del proyecto se genera automáticamente y cuál es su estructura según la MGA?"
            fieldHelpKey="name"
            projectContext={fieldProjectContext}
          >
            <div
              id="project-generated-name"
              className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 min-h-[40px]"
            >
              {generatedName || (
                <span className="italic text-gray-400">
                  Se generará a partir de proceso + objeto + localizaciones
                </span>
              )}
            </div>
          </AIAssistedField>

          {/* ── Proceso ── */}
          <AIAssistedField
            label="Proceso"
            prefilledSuggestions={projectSuggestions?.proceso}
            onApplySuggestion={(sug) => {
              if (sug) {
                const match = procesos.find(p => p.name.toLowerCase().includes(sug.toLowerCase()));
                if (match) setProceso(match.id.toString());
              }
            }}
            htmlFor="project-proceso"
            required
            guidance="Verbo rector que define el tipo de intervención del proyecto según la MGA (ej: Construcción, Adquisición, Dotación)."
            askPrompt="¿Qué es el proceso en la formulación MGA y cómo elijo el verbo rector correcto para mi proyecto?"
          >
            <SearchableCombobox
              id="project-proceso"
              label=""
              placeholder="Busque y seleccione un proceso..."
              options={procesoOptions}
              value={proceso}
              onChange={setProceso}
            />
          </AIAssistedField>

          {/* ── Objeto ── */}
          <AIAssistedField
            label="Objeto"
            prefilledSuggestions={projectSuggestions?.objeto}
            onApplySuggestion={(sug) => sug && setObjeto(sug)}
            htmlFor="project-objeto"
            required
            guidance="Describa brevemente qué se entrega (bien o servicio público). Máximo 1000 caracteres. Este texto es parte del nombre oficial del proyecto."
            askPrompt="¿Cómo redacto el objeto de un proyecto MGA? Dame ejemplos de buena y mala redacción."
            fieldHelpKey="objeto"
            projectContext={fieldProjectContext}
            onAutoFill={(v) => setObjeto(v)}
          >
            <textarea spellCheck={true}
              id="project-objeto"
              required
              maxLength={1000}
              rows={3}
              value={objeto}
              onChange={(e) => setObjeto(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
              placeholder="Ej: acueducto rural para mejorar acceso a agua potable en veredas del municipio"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-500 block">Mínimo 10 caracteres</span>
              <p className="text-xs text-gray-400 text-right">{objeto.length}/1000</p>
            </div>
          </AIAssistedField>

          {/* ── Localizaciones ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Localizaciones <span className="text-red-500">*</span>
              </label>
              {projectSuggestions?.localizaciones && projectSuggestions.localizaciones.length > 0 && (
                <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 text-xs shadow-sm">
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                  {projectSuggestions.localizaciones.map((locOption, idx) => {
                    const locLabel = locOption.map(l => [l.departamento, l.municipio].filter(Boolean).join(', ')).join(' y ');
                    return (
                      <span key={idx} className="inline-flex items-center">
                        <span className="font-medium max-w-xs truncate" title={locLabel}>
                          {locLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const newLocs = locOption.map(locSug => {
                              let depId: number | null = null;
                              let munId: number | null = null;
                              let regId: number | null = null;
                              
                              if (locSug.departamento) {
                                 for (const r of regions) {
                                   const dep = r.departamentos.find(d => d.name.toLowerCase().includes(locSug.departamento!.toLowerCase()));
                                   if (dep) {
                                     regId = r.id;
                                     depId = dep.id;
                                     if (locSug.municipio) {
                                        const mun = dep.municipios.find(m => m.name.toLowerCase().includes(locSug.municipio!.toLowerCase()));
                                        if (mun) munId = mun.id;
                                     }
                                     break;
                                   }
                                 }
                              }
                              return { regionId: regId, departamentoId: depId, municipioId: munId };
                            });
                            if (newLocs.length > 0) {
                               setLocalizaciones(newLocs);
                            }
                          }}
                          className="ml-2 font-semibold hover:underline text-[#006162]"
                        >
                          [Usar]
                        </button>
                        {idx < projectSuggestions.localizaciones.length - 1 && <span className="ml-2 text-teal-300">|</span>}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-3">
              {localizaciones.map((loc, idx) => {
                const selectedRegion = regions.find(r => r.id === loc.regionId);
                const selectedDepto = getDepartamentos(loc.regionId).find(d => d.id === loc.departamentoId);
                const selectedMun = getMunicipios(loc.regionId, loc.departamentoId).find(m => m.id === loc.municipioId);

                return (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 mb-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-800">Localización #{idx + 1}</h4>
                      {localizaciones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLocation(idx)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                          aria-label={`Quitar localización ${idx + 1}`}
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Quitar localización
                        </button>
                      )}
                    </div>
                    
                    <div className="flex flex-col space-y-3">
                      <div>
                        <span className="text-sm font-semibold text-slate-700 mb-1 block">Región</span>
                        <SearchableCombobox
                          id={`region-${idx}`}
                          label=""
                          placeholder="Seleccione Región"
                          options={regions.map(r => ({ value: String(r.id), label: r.name, code: String(r.id) }))}
                          value={loc.regionId ? String(loc.regionId) : ''}
                          onChange={(val) => updateLocation(idx, 'regionId', val ? Number(val) : null)}
                        />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-700 mb-1 block">Departamento</span>
                        <SearchableCombobox
                          id={`dep-${idx}`}
                          label=""
                          placeholder="Seleccione Departamento"
                          disabled={!loc.regionId}
                          options={getDepartamentos(loc.regionId).map(d => ({ value: String(d.id), label: d.name, code: String(d.id) }))}
                          value={loc.departamentoId ? String(loc.departamentoId) : ''}
                          onChange={(val) => updateLocation(idx, 'departamentoId', val ? Number(val) : null)}
                        />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-700 mb-1 block">Municipio</span>
                        <SearchableCombobox
                          id={`mun-${idx}`}
                          label=""
                          placeholder="Seleccione Municipio (opc.)"
                          disabled={!loc.departamentoId}
                          options={getMunicipios(loc.regionId, loc.departamentoId).map(m => ({ value: String(m.id), label: m.name, code: String(m.id) }))}
                          value={loc.municipioId ? String(loc.municipioId) : ''}
                          onChange={(val) => updateLocation(idx, 'municipioId', val ? Number(val) : null)}
                        />
                      </div>
                    </div>

                    {loc.regionId && loc.departamentoId && loc.municipioId && (
                      <div className="bg-emerald-100/70 text-emerald-800 text-sm p-2 rounded-md font-medium mt-3">
                        ✓ {selectedRegion?.name} › {selectedDepto?.name} › {selectedMun?.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addLocation}
              className="w-full sm:w-auto px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg font-medium hover:bg-emerald-100 flex items-center justify-center gap-2 transition-colors mt-2"
            >
              + Agregar otra localización
            </button>
          </div>

          <hr className="border-gray-100" />

          {/* ── Tipo de inversión ── */}
          <div>
            <label htmlFor="project-tipo-inversion" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de inversión <span className="text-red-500">*</span>
            </label>
            <select
              id="project-tipo-inversion"
              value={tipoInversion}
              onChange={(e) => setTipoInversion(e.target.value)}
              disabled={!!projectSuggestions && !editProject}
              className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60"
            >
              {TIPOS_INVERSION.map((t) => (
                <option key={t.value} value={t.value} disabled={t.disabled}>
                  {t.label}
                  {t.disabled ? ' (no disponible)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* ── Tipología de proyecto ── */}
          <AIAssistedField
            label="Tipología de proyecto"
            htmlFor="project-tipologia"
            required
            guidance="La tipología determina la estructura de productos del catálogo MGA disponible para este proyecto."
            askPrompt="¿Cuáles son las tipologías de proyecto MGA y cómo afectan la formulación?"
          >
            <select
              id="project-tipologia"
              required
              value={tipologiaProyecto}
              onChange={(e) => handleTipologiaChange(e.target.value)}
              disabled={!!projectSuggestions && !editProject}
              className="w-full rounded border border-gray-300 px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60"
            >
              <option value="">Selecciona una tipología</option>
              {TIPOLOGIAS_PROYECTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </AIAssistedField>

          {/* ── Sector (filtrado por tipología) ── */}
          <AIAssistedField
            label="Sector"
            prefilledSuggestions={projectSuggestions?.sector_id?.map(sid => sectors.find(s => s.id === sid)?.name || sid).filter(Boolean)}
            onApplySuggestion={(sug) => {
              const s = sectors.find(s => s.name === sug || s.id === sug);
              if (s) setSectorId(s.id);
            }}
            htmlFor="project-sector"
            required
            guidance="El sector define la clasificación programática DNP. Cuando la tipología es 'A - PIIP', solo se muestran los sectores con ámbito territorial."
            askPrompt="¿Cómo elijo el sector correcto del catálogo DNP para mi proyecto de inversión? Explica el criterio de clasificación programática."
          >
            <SearchableCombobox
              id="project-sector"
              label=""
              placeholder={!tipologiaProyecto ? 'Selecciona primero una tipología' : 'Selecciona un sector'}
              disabled={!tipologiaProyecto}
              options={sectorOptions}
              value={sectorId}
              onChange={(val) => {
                setSectorId(val);
                setProductoPrincipal('');
              }}
            />
          </AIAssistedField>

          {/* ── Producto principal (habilitado tras sector) ── */}
          <AIAssistedField
            label="Producto principal"
            prefilledSuggestions={projectSuggestions?.producto_principal || (projectSuggestions as any)?.producto || (projectSuggestions as any)?.productos}
            onApplySuggestion={(sug) => {
              if (!sug) return;
              const nQuery = sug.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const prod = catalogProducts.find(p => {
                const nName = p.producto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return nName.includes(nQuery) || nQuery.includes(nName);
              });
              if (prod) setProductoPrincipal(prod.codigo_del_producto);
            }}
            htmlFor="project-producto-principal"
            required
            guidance="El producto principal es el bien o servicio público que el proyecto entregará. Se habilita tras seleccionar el sector."
            askPrompt="¿Cómo identifico el producto principal de mi proyecto MGA en el catálogo DNP?"
          >
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <SearchableCombobox
                  id="project-producto-principal"
                  label=""
                  placeholder={
                    !sectorId
                      ? 'Selecciona primero un sector'
                      : isLoadingProducts
                        ? 'Cargando productos…'
                        : 'Selecciona un producto'
                  }
                  disabled={!sectorId || isLoadingProducts}
                  options={productOptions}
                  value={productoPrincipal}
                  onChange={setProductoPrincipal}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const prod = catalogProducts.find(p => p.codigo_del_producto === productoPrincipal);
                  if (prod) {
                    setSelectedProductData(prod);
                    setIsProductModalOpen(true);
                  }
                }}
                disabled={!sectorId || isLoadingProducts || !productoPrincipal}
                className="shrink-0 rounded border border-gray-300 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-gray-50 disabled:opacity-50 disabled:bg-gray-100"
              >
                Ver detalle
              </button>
            </div>
          </AIAssistedField>

          {formError && (
            <div
              role="alert"
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              className="rounded px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-2 text-sm font-medium"
            >
              <span className="material-symbols-outlined text-base">add</span>
              {isLoading ? 'Creando…' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      )}
      </div>

      {isProductModalOpen && sectorId && selectedSector && (
        <ProductDetailModal
          open={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          product={selectedProductData}
          onSelect={setProductoPrincipal}
        />
      )}
    </div>
  );
}
