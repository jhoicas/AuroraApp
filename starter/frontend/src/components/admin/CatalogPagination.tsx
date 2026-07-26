import type { CatalogPageMeta } from '../../store/catalogStore';

type CatalogPaginationProps = {
  meta: CatalogPageMeta | null | undefined;
  onPageChange: (page: number) => void;
  /** Filas visibles en la página actual (opcional; por defecto usa meta.limit). */
  shown?: number;
};

export default function CatalogPagination({
  meta,
  onPageChange,
  shown,
}: CatalogPaginationProps) {
  const total = meta?.total ?? 0;
  const page = meta?.page ?? 1;
  const limit = meta?.limit ?? 10;
  const totalPages = Math.max(1, meta?.last_page ?? 1);
  const displayed = shown ?? Math.min(limit, total);
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const maxButtons = 5;
  const start = Math.max(
    1,
    Math.min(currentPage - 2, Math.max(1, totalPages - maxButtons + 1)),
  );
  const pages = Array.from(
    { length: Math.min(totalPages, maxButtons) },
    (_, i) => start + i,
  ).filter((n) => n <= totalPages);

  return (
    <div className="p-6 bg-[#f0f3ff] flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-[#bec9c8]">
      <span className="text-base font-medium text-[#3f4949]">
        Mostrando {displayed} de {total} registros
      </span>
      <div className="flex gap-2 flex-wrap justify-center">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="w-12 h-12 flex items-center justify-center rounded-lg border border-[#bec9c8] hover:bg-white transition-colors disabled:opacity-40"
          aria-label="Página anterior"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        {pages.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            className={`w-12 h-12 flex items-center justify-center rounded-lg font-bold transition-colors ${
              currentPage === n
                ? 'bg-[#006162] text-white'
                : 'border border-[#bec9c8] hover:bg-white'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="w-12 h-12 flex items-center justify-center rounded-lg border border-[#bec9c8] hover:bg-white transition-colors disabled:opacity-40"
          aria-label="Página siguiente"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
