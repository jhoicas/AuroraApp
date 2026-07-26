import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalogStore } from '../../store/catalogStore';

const SECTOR_ICONS = ['medical_services', 'school', 'agriculture', 'apartment', 'water_drop', 'bolt'];

export default function CatalogPage() {
  const navigate = useNavigate();
  const sectors = useCatalogStore((s) => s.sectors);
  const programs = useCatalogStore((s) => s.programs);
  const products = useCatalogStore((s) => s.products);
  const isLoading = useCatalogStore((s) => s.isLoading);
  const fetchSectors = useCatalogStore((s) => s.fetchSectors);
  const fetchPrograms = useCatalogStore((s) => s.fetchProgramsBySector);
  const searchProducts = useCatalogStore((s) => s.searchProducts);

  const [query, setQuery] = useState('');
  const [openSectorId, setOpenSectorId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    void fetchSectors();
    void searchProducts('');
  }, [fetchSectors, searchProducts]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void searchProducts(query);
    }, 400);
    return () => window.clearTimeout(t);
  }, [query, searchProducts]);

  const filteredSectors = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sectors;
    return sectors.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.code.toLowerCase().includes(term),
    );
  }, [sectors, query]);

  const handleToggleSector = async (sectorId: string) => {
    if (openSectorId === sectorId) {
      setOpenSectorId(null);
      return;
    }
    setOpenSectorId(sectorId);
    await fetchPrograms(sectorId);
  };

  const sectorProducts = (programIds: string[]) =>
    products.filter((p) => programIds.includes(p.program_id));

  const copyBpin = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="-m-6">
      <section className="px-6 py-8 md:px-10 bg-gray-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-bold text-[#006162] mb-3">
            Catálogo DNP · Solo lectura
          </h2>
          <p className="text-base md:text-lg text-gray-600 mb-6 max-w-3xl">
            Explore sectores, programas y productos oficiales del Departamento Nacional de Planeación
            para la formulación de proyectos de inversión pública.
          </p>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#006162] text-3xl">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por sector, programa o código de producto…"
              className="w-full h-16 md:h-[72px] pl-16 pr-4 bg-white border-2 border-gray-200 rounded-xl text-base md:text-lg focus:outline-none focus:border-[#006162] focus:ring-4 focus:ring-[#006162]/10 transition-all"
            />
          </div>
        </div>
      </section>

      <section className="px-6 py-8 md:px-10">
        <div className="max-w-6xl mx-auto space-y-4">
          {isLoading && sectors.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
              Cargando catálogo…
            </div>
          )}

          {!isLoading && filteredSectors.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
              <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">search_off</span>
              <p className="font-medium text-gray-700">No se encontraron sectores</p>
            </div>
          )}

          {filteredSectors.map((sector, index) => {
            const open = openSectorId === sector.id;
            const sectorProgramIds = programs
              .filter((p) => p.sector_id === sector.id)
              .map((p) => p.id);
            const relatedProducts = open ? sectorProducts(sectorProgramIds) : [];

            return (
              <div
                key={sector.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <button
                  type="button"
                  onClick={() => void handleToggleSector(sector.id)}
                  className="w-full flex items-center justify-between p-4 md:p-6 text-left hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#006162]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#006162]/10 flex items-center justify-center text-[#006162]">
                      <span className="material-symbols-outlined text-3xl">
                        {SECTOR_ICONS[index % SECTOR_ICONS.length]}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl font-semibold text-gray-900">{sector.name}</h3>
                      <p className="text-sm text-gray-500">
                        Código {sector.code}
                        {open && programs.length > 0
                          ? ` · ${programs.filter((p) => p.sector_id === sector.id).length} programas`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[#006162] text-3xl transition-transform duration-300 ${
                      open ? 'rotate-180' : ''
                    }`}
                  >
                    expand_more
                  </span>
                </button>

                {open && (
                  <div className="border-t border-gray-200 bg-gray-50/80 p-4 md:p-6 space-y-6">
                    {isLoading && (
                      <p className="text-center text-gray-500 py-6">Cargando programas y productos…</p>
                    )}

                    {!isLoading &&
                      programs
                        .filter((p) => p.sector_id === sector.id)
                        .map((program) => {
                          const progProducts = products.filter((pr) => pr.program_id === program.id);
                          return (
                            <div key={program.id} className="pl-4 border-l-4 border-[#006162]/20">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-[#006162]">folder_open</span>
                                <h4 className="text-sm font-semibold text-[#006162] uppercase tracking-wider">
                                  {program.code} — {program.name}
                                </h4>
                              </div>

                              {progProducts.length === 0 ? (
                                <div className="bg-white p-4 rounded-lg flex items-center gap-3 text-gray-500 italic border border-gray-100">
                                  <span className="material-symbols-outlined">info</span>
                                  No hay productos cargados para este programa.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {progProducts.map((product) => {
                                    const bpin = product.code_bpin || product.code;
                                    return (
                                      <div
                                        key={product.id}
                                        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-[#006162] transition-colors"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className="bg-teal-100 text-[#004f50] font-bold text-xs px-2 py-1 rounded">
                                              BPIN: {bpin}
                                            </span>
                                          </div>
                                          <p className="font-semibold text-gray-900">{product.name}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => void copyBpin(bpin, product.id)}
                                            className="h-12 px-4 inline-flex items-center gap-2 border-2 border-[#006162] text-[#006162] font-semibold rounded-lg hover:bg-[#006162]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] transition-all"
                                          >
                                            <span className="material-symbols-outlined text-base">
                                              {copiedId === product.id ? 'check_circle' : 'content_copy'}
                                            </span>
                                            {copiedId === product.id ? 'Copiado' : 'Copiar BPIN'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => navigate('/tenant/projects')}
                                            className="h-12 px-4 inline-flex items-center gap-2 bg-[#006162] hover:bg-[#004f50] text-white font-semibold rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#006162] transition-all"
                                          >
                                            <span className="material-symbols-outlined text-base">add_circle</span>
                                            Usar en mi proyecto
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                    {!isLoading &&
                      programs.filter((p) => p.sector_id === sector.id).length === 0 &&
                      relatedProducts.length === 0 && (
                        <p className="text-center text-gray-500 py-4">
                          Este sector aún no tiene programas en el catálogo.
                        </p>
                      )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="bg-[#006162]/5 rounded-xl p-8 md:p-12 border border-[#006162]/20 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm">
              <span className="material-symbols-outlined text-[#006162] text-4xl">auto_awesome</span>
            </div>
            <h3 className="text-xl font-semibold text-[#006162] mb-2">¿No encuentra lo que busca?</h3>
            <p className="text-gray-600 max-w-lg mb-6">
              El catálogo se sincroniza con los lineamientos del DNP. Si su producto no aparece, solicite
              una revisión técnica a su administrador.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
