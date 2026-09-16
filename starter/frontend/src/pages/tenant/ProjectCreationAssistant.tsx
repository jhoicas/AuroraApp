import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ActionCard from '../../components/AuroraCopilot/ActionCard';
import AssistantMarkdown from '../../components/AuroraAsistente/AssistantMarkdown';
import SearchableCombobox, {
  type ComboboxOption,
} from '../../components/Catalog/SearchableCombobox';
import { dispatchActionCard } from '../../lib/auroraActionDispatcher';
import ProductDetailModal from '../../components/Tenant/ProductDetailModal';
import {
  CATALOG_FULL_LIST_LIMIT,
  formatCatalogProductOptionTitle,
  useCatalogStore,
  type CatalogProgram,
  type CatalogSector,
  type Product,
} from '../../store/catalogStore';
import {
  ROUTE_PROJECT_CREATION,
  useAuroraCopilotStore,
  type ActionCardPayload,
  type CreationContext,
} from '../../store/auroraCopilotStore';
import {
  useLocationStore,
  generateProjectName,
  type LocationSelection,
} from '../../store/locationStore';

const inputClass =
  'w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-[#006162] focus:ring-4 focus:ring-[#006162]/10 transition-all disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed';

const EMPTY_LOCATION: LocationSelection = {
  regionId: null,
  departamentoId: null,
  municipioId: null,
};

export default function ProjectCreationAssistant() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const sectors = useCatalogStore((s) => s.sectors);
  const programs = useCatalogStore((s) => s.programs);
  const programsSectorId = useCatalogStore((s) => s.programsSectorId);
  const catalogProducts = useCatalogStore((s) => s.catalogProducts);
  const catalogProductsProgramCode = useCatalogStore((s) => s.catalogProductsProgramCode);
  const isLoadingSectors = useCatalogStore((s) => s.isLoading);
  const isLoadingSectorPrograms = useCatalogStore((s) => s.isLoadingSectorPrograms);
  const isLoadingProducts = useCatalogStore((s) => s.isLoadingProducts);
  const fetchSectors = useCatalogStore((s) => s.fetchSectors);
  const fetchPrograms = useCatalogStore((s) => s.fetchProgramsBySector);
  const fetchCatalogProducts = useCatalogStore((s) => s.fetchCatalogProducts);
  const clearPrograms = useCatalogStore((s) => s.clearPrograms);
  const clearProducts = useCatalogStore((s) => s.clearProducts);

  const {
    messages,
    isTyping,
    error,
    draftInput,
    interviewStarted,
    interviewCreationContext,
    startInterview,
    sendMessage,
    cancelGeneration,
    clearError,
    endInterview,
    setDraftInput,
  } = useAuroraCopilotStore();

  // Location + Proceso store
  const regions = useLocationStore((s) => s.regions);
  const procesos = useLocationStore((s) => s.procesos);
  const fetchLocations = useLocationStore((s) => s.fetchLocations);
  const fetchProcesos = useLocationStore((s) => s.fetchProcesos);

  const [ideaSummary, setIdeaSummary] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [programCode, setProgramCode] = useState('');
  const [productPickerId, setProductPickerId] = useState('');
  const [selectedProductCodes, setSelectedProductCodes] = useState<string[]>([]);
  const [selectedProgramCodes, setSelectedProgramCodes] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState<Product | null>(null);

  // MGA name fields
  const [proceso, setProceso] = useState('');
  const [objeto, setObjeto] = useState('');
  const [localizaciones, setLocalizaciones] = useState<LocationSelection[]>([
    { ...EMPTY_LOCATION },
  ]);

  useEffect(() => {
    void fetchSectors({ page: 1, limit: CATALOG_FULL_LIST_LIMIT });
    void fetchLocations();
    void fetchProcesos();
    return () => endInterview();
  }, [fetchSectors, fetchLocations, fetchProcesos, endInterview]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, isTyping]);

  const selectedSector: CatalogSector | undefined = useMemo(
    () => sectors.find((s) => s.id === sectorId),
    [sectors, sectorId],
  );

  // ── MGA auto-generated name ──
  const procesoName = useMemo(
    () => procesos.find((p) => String(p.id) === proceso)?.name ?? '',
    [procesos, proceso],
  );

  const generatedName = useMemo(
    () => generateProjectName(procesoName, objeto, localizaciones, regions),
    [procesoName, objeto, localizaciones, regions],
  );

  // ── Location helpers ──
  const updateLocation = useCallback(
    (index: number, field: keyof LocationSelection, value: number | null) => {
      setLocalizaciones((prev) => {
        const copy = [...prev];
        const item = { ...copy[index] };
        item[field] = value;
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
      return regions
        .find((r) => r.id === regionId)
        ?.departamentos.find((d) => d.id === depId)
        ?.municipios ?? [];
    },
    [regions],
  );

  const sectorPrograms: CatalogProgram[] = useMemo(() => {
    if (!sectorId || programsSectorId !== sectorId) return [];
    return programs.filter((p) => p.sector_id === sectorId);
  }, [programs, programsSectorId, sectorId]);

  const filteredProducts: Product[] = useMemo(() => {
    if (!programCode || catalogProductsProgramCode !== programCode) return [];
    return catalogProducts.filter(
      (p) =>
        p.codigo_del_programa === programCode ||
        p.codigo_del_programa.startsWith(programCode),
    );
  }, [catalogProducts, catalogProductsProgramCode, programCode]);

  const procesoOptions: ComboboxOption[] = useMemo(
    () => procesos.map((p) => ({ value: String(p.id), label: p.name })),
    [procesos]
  );

  const sectorOptions: ComboboxOption[] = useMemo(
    () =>
      sectors.map((sector) => ({
        value: sector.id,
        code: sector.code,
        label: sector.name,
      })),
    [sectors],
  );

  const programOptions: ComboboxOption[] = useMemo(
    () =>
      sectorPrograms.map((program) => ({
        value: program.code,
        code: program.code,
        label: program.name,
      })),
    [sectorPrograms],
  );

  const productOptions: ComboboxOption[] = useMemo(
    () =>
      filteredProducts
        .filter((p) => !selectedProductCodes.includes(p.codigo_del_producto))
        .map((product) => ({
          value: product.id,
          code: product.codigo_del_producto,
          label: product.producto,
          indicatorCode: product.codigo_del_indicador_de_producto,
          indicatorLabel: product.indicador_de_producto,
          hint: formatCatalogProductOptionTitle(product),
        })),
    [filteredProducts, selectedProductCodes],
  );

  const handleSectorChange = useCallback(
    (nextSectorId: string) => {
      setSectorId(nextSectorId);
      setProgramCode('');
      setProductPickerId('');
      setSelectedProgramCodes([]);
      setSelectedProductCodes([]);
      clearProducts();
      if (!nextSectorId) {
        clearPrograms();
        return;
      }
      void fetchPrograms(nextSectorId);
    },
    [clearProducts, clearPrograms, fetchPrograms],
  );

  const handleProgramChange = useCallback(
    (nextProgramCode: string) => {
      setProgramCode(nextProgramCode);
      setProductPickerId('');
      setSelectedProductCodes([]);
      clearProducts();
      if (!nextProgramCode) {
        setSelectedProgramCodes([]);
        return;
      }
      setSelectedProgramCodes([nextProgramCode]);
      void fetchCatalogProducts({
        page: 1,
        limit: CATALOG_FULL_LIST_LIMIT,
        search: nextProgramCode,
      });
    },
    [clearProducts, fetchCatalogProducts],
  );

  const handleAddProduct = useCallback(
    (nextProductId: string) => {
      const product = filteredProducts.find((p) => p.id === nextProductId);
      if (!product) return;
      const code = product.codigo_del_producto.trim();
      if (!code || selectedProductCodes.includes(code)) return;
      setSelectedProductCodes((prev) => [...prev, code]);
      setProductPickerId('');
    },
    [filteredProducts, selectedProductCodes],
  );

  const handleRemoveProduct = (code: string) => {
    setSelectedProductCodes((prev) => prev.filter((c) => c !== code));
  };

  const buildCreationContext = (): CreationContext => ({
    ideaSummary: ideaSummary.trim(),
    sectorCode: selectedSector?.code,
    sectorName: selectedSector?.name,
    sectorId: selectedSector?.id,
    productCodes: selectedProductCodes,
    programCodes: selectedProgramCodes,
    procesoId: parseInt(proceso, 10) || undefined,
    objeto: objeto.trim(),
    localizaciones: localizaciones,
    tipoInversion: 'Territorial',
  });

  const handleStartInterview = async () => {
    setStartError(null);
    if (!proceso) {
      setStartError('El proceso es obligatorio.');
      return;
    }
    if (!objeto.trim()) {
      setStartError('El objeto del proyecto es obligatorio.');
      return;
    }
    if (localizaciones.length === 0 || !localizaciones.some(l => l.regionId)) {
      setStartError('Debe seleccionar al menos una localización con su respectiva región.');
      return;
    }
    if (!sectorId) {
      setStartError('Selecciona un sector.');
      return;
    }
    if (selectedProductCodes.length === 0) {
      setStartError('Debe añadir al menos un producto principal.');
      return;
    }
    const idea = ideaSummary.trim();
    if (idea.length < 10) {
      setStartError('Describe tu idea con al menos 10 caracteres.');
      return;
    }
    try {
      await startInterview(buildCreationContext());
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'No se pudo iniciar la entrevista');
    }
  };

  const handleSendChat = async () => {
    const text = draftInput.trim();
    if (!text || isTyping || !interviewStarted) return;
    await sendMessage(text, ROUTE_PROJECT_CREATION);
  };

  const handleApplyCard = useCallback(
    async (card: ActionCardPayload) => {
      await dispatchActionCard(card, '', {
        navigate,
        pathname: '/tenant/projects/create-assistant',
        creationContext: interviewCreationContext,
      });
      setToast('¡Proyecto creado! Redirigiendo a formulación…');
      window.setTimeout(() => setToast(null), 3500);
    },
    [interviewCreationContext, navigate],
  );

  const inputsLocked = interviewStarted;

  return (
    <div className="fixed inset-0 left-64 z-20 flex flex-col bg-gray-50 top-0">
      <header className="shrink-0 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/tenant/projects"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#006162]"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Proyectos
          </Link>
          <span className="text-gray-300">|</span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">Creación asistida con Aurora</h1>
            <p className="text-xs text-gray-500">Entrevista MGA guiada por IA</p>
          </div>
        </div>
        {interviewStarted && (
          <button
            type="button"
            onClick={() => endInterview()}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Reiniciar entrevista
          </button>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Panel izquierdo — contexto */}
        <aside className="w-[30%] min-w-[280px] max-w-md shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-y-auto">
          <div className="p-5 space-y-5 flex-1">
            {/* ── Nombre auto-generado ── */}
            {generatedName && (
              <div className="rounded-lg border-2 border-[#006162]/20 bg-[#006162]/5 p-3">
                <p className="text-xs font-semibold text-[#006162] mb-1">Nombre del proyecto</p>
                <p className="text-sm text-gray-800">{generatedName}</p>
              </div>
            )}

            {/* ── Proceso MGA ── */}
            <div>
              <label htmlFor="creation-proceso" className="block text-sm font-semibold text-gray-800 mb-1">
                Proceso <span className="text-red-500">*</span>
              </label>
              <SearchableCombobox
                id="creation-proceso"
                label=""
                placeholder="Selecciona un proceso"
                options={procesoOptions}
                value={proceso}
                onChange={setProceso}
                disabled={inputsLocked}
              />
            </div>

            {/* ── Objeto ── */}
            <div>
              <label htmlFor="creation-objeto" className="block text-sm font-semibold text-gray-800 mb-1">
                Objeto <span className="text-red-500">*</span>
              </label>
              <textarea
                id="creation-objeto"
                required
                rows={3}
                maxLength={1000}
                value={objeto}
                onChange={(e) => setObjeto(e.target.value)}
                disabled={inputsLocked}
                placeholder="Ej: acueducto rural para mejorar acceso a agua potable"
                className={`${inputClass} resize-none`}
              />
              <p className="text-xs text-gray-400 mt-0.5 text-right">{objeto.length}/1000</p>
            </div>

            {/* ── Localizaciones ── */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Localizaciones <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {localizaciones.map((loc, idx) => (
                  <div key={idx} className="flex gap-1 items-start">
                    <div className="flex-1 grid grid-cols-3 gap-1">
                      <select
                        value={loc.regionId ?? ''}
                        onChange={(e) =>
                          updateLocation(idx, 'regionId', e.target.value ? Number(e.target.value) : null)
                        }
                        disabled={inputsLocked}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white"
                        aria-label={`Región ${idx + 1}`}
                      >
                        <option value="">Región</option>
                        {regions.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <select
                        value={loc.departamentoId ?? ''}
                        onChange={(e) =>
                          updateLocation(idx, 'departamentoId', e.target.value ? Number(e.target.value) : null)
                        }
                        disabled={inputsLocked || !loc.regionId}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white disabled:bg-gray-50"
                        aria-label={`Departamento ${idx + 1}`}
                      >
                        <option value="">Depto.</option>
                        {getDepartamentos(loc.regionId).map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <select
                        value={loc.municipioId ?? ''}
                        onChange={(e) =>
                          updateLocation(idx, 'municipioId', e.target.value ? Number(e.target.value) : null)
                        }
                        disabled={inputsLocked || !loc.departamentoId}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white disabled:bg-gray-50"
                        aria-label={`Municipio ${idx + 1}`}
                      >
                        <option value="">Mpio. (opc.)</option>
                        {getMunicipios(loc.regionId, loc.departamentoId).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    {localizaciones.length > 1 && !inputsLocked && (
                      <button
                        type="button"
                        onClick={() => removeLocation(idx)}
                        className="mt-1 text-red-400 hover:text-red-600 shrink-0"
                        aria-label={`Quitar localización ${idx + 1}`}
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!inputsLocked && (
                <button
                  type="button"
                  onClick={addLocation}
                  className="mt-1 inline-flex items-center gap-0.5 text-xs text-[#006162] hover:underline font-medium"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Agregar
                </button>
              )}
            </div>

            <hr className="border-gray-100" />

            {/* ── Describe tu idea ── */}
            <div>
              <label htmlFor="idea-summary" className="block text-sm font-semibold text-gray-800 mb-2">
                Describe tu idea de proyecto
              </label>
              <textarea
                id="idea-summary"
                rows={5}
                value={ideaSummary}
                onChange={(e) => setIdeaSummary(e.target.value)}
                disabled={inputsLocked}
                placeholder="Ej.: Quiero formular un proyecto de acueducto rural para mejorar el acceso al agua potable en veredas del municipio…"
                className={`${inputClass} resize-none min-h-[120px]`}
              />
            </div>

            <div>
              <SearchableCombobox
                id="creation-sector"
                label="Sector"
                placeholder="Buscar sector…"
                value={sectorId}
                onChange={handleSectorChange}
                options={sectorOptions}
                disabled={inputsLocked || isLoadingSectors}
                loading={isLoadingSectors}
              />
            </div>

            <div>
              <SearchableCombobox
                id="creation-program"
                label="Programa"
                placeholder={sectorId ? 'Buscar programa…' : 'Seleccione un sector primero'}
                value={programCode}
                onChange={handleProgramChange}
                options={programOptions}
                disabled={inputsLocked || !sectorId || isLoadingSectorPrograms}
                loading={isLoadingSectorPrograms}
              />
            </div>

            <div>
              <SearchableCombobox
                id="creation-product"
                label="Productos"
                placeholder={programCode ? 'Añadir producto…' : 'Seleccione un programa primero'}
                value={productPickerId}
                onChange={handleAddProduct}
                options={productOptions}
                disabled={inputsLocked || !programCode || isLoadingProducts}
                loading={isLoadingProducts}
              />
              {selectedProductCodes.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {selectedProductCodes.map((code) => (
                    <li key={code}>
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs text-[#006162]">
                        {code}
                        <button
                          type="button"
                          onClick={() => {
                            const prod = catalogProducts.find((p) => p.codigo_del_producto === code);
                            if (prod) {
                              setSelectedProductData(prod);
                              setIsProductModalOpen(true);
                            }
                          }}
                          className="hover:text-[#004f50] ml-1"
                          aria-label={`Ver detalle de producto ${code}`}
                        >
                          <span className="material-symbols-outlined text-[14px]">info</span>
                        </button>
                        {!inputsLocked && (
                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(code)}
                            className="hover:text-red-600"
                            aria-label={`Quitar producto ${code}`}
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {startError && (
              <p role="alert" className="text-sm text-red-600">
                {startError}
              </p>
            )}
          </div>

          <div className="p-5 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={() => void handleStartInterview()}
              disabled={inputsLocked || isTyping || ideaSummary.trim().length < 10}
              className="w-full h-12 rounded-lg bg-[#006162] hover:bg-[#004f50] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined">auto_awesome</span>
              {interviewStarted ? 'Entrevista en curso' : 'Iniciar Entrevista MGA'}
            </button>
          </div>
        </aside>

        {/* Panel derecho — chat */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#f7faf9]">
          {!interviewStarted ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <span className="material-symbols-outlined text-5xl text-[#006162]/40 mb-4">forum</span>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Listo para comenzar</h2>
              <p className="text-gray-500 max-w-md">
                Describe tu idea a la izquierda y pulsa &quot;Iniciar Entrevista MGA&quot; para que Aurora
                te guíe paso a paso.
              </p>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#006162] text-white rounded-br-md'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <AssistantMarkdown content={msg.content} />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                      {msg.actionCards?.map((card, index) => (
                        <div
                          key={`${card.type ?? 'card'}-${index}`}
                          className="mt-3"
                        >
                          <ActionCard card={card} onApply={handleApplyCard} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <p className="text-center text-xs text-gray-500 py-2">Aurora está escribiendo…</p>
                )}
              </div>

              {toast && (
                <div
                  role="status"
                  className="px-4 py-2 bg-teal-50 border-t border-teal-200 text-xs text-[#006162] font-medium"
                >
                  {toast}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="px-4 py-2 bg-red-50 border-t text-xs text-red-700 flex justify-between gap-2"
                >
                  <span>{error}</span>
                  <button type="button" onClick={clearError} className="underline shrink-0">
                    Cerrar
                  </button>
                </div>
              )}

              <footer className="shrink-0 p-4 border-t border-gray-200 bg-white">
                <div className="flex gap-2 items-end max-w-4xl mx-auto">
                  <textarea
                    ref={chatInputRef}
                    rows={2}
                    value={draftInput}
                    onChange={(e) => setDraftInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendChat();
                      }
                    }}
                    placeholder="Responde a Aurora…"
                    disabled={isTyping}
                    aria-label="Mensaje para Aurora"
                    className="flex-1 min-h-[56px] max-h-[160px] resize-none px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#006162]/40 focus:border-[#006162] disabled:opacity-60"
                  />
                  {isTyping ? (
                    <button
                      type="button"
                      onClick={cancelGeneration}
                      className="shrink-0 h-11 px-3 border border-red-200 rounded-xl text-red-600 text-sm font-medium"
                    >
                      Detener
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleSendChat()}
                      disabled={!draftInput.trim()}
                      className="shrink-0 h-11 px-5 rounded-xl bg-[#006162] text-white text-sm font-semibold disabled:opacity-50"
                    >
                      Enviar
                    </button>
                  )}
                </div>
              </footer>
            </>
          )}
        </section>
      </div>

      <ProductDetailModal
        open={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={selectedProductData}
        onSelect={(_code) => {
          // Ya está seleccionado si llegó aquí por el chip, no es necesario hacer nada extra
        }}
      />
    </div>
  );
}
