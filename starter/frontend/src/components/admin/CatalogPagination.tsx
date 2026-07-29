import type { CatalogPageMeta } from '../../store/catalogStore';

type CatalogPaginationProps = {
  meta: CatalogPageMeta | null | undefined;
  onPageChange: (page: number) => void;
  /** Filas visibles en la página actual (opcional; por defecto se calcula desde meta). */
  shown?: number;
};

type PageToken = number | 'ellipsis';

/** Ventana con primera/última página y elipsis (ej. 1 … 4 5 6 … 18). */
function buildPageTokens(currentPage: number, totalPages: number, siblingCount = 1): PageToken[] {
  if (totalPages <= 1) {
    return [1];
  }
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const tokens: PageToken[] = [1];
  const leftSibling = Math.max(2, currentPage - siblingCount);
  const rightSibling = Math.min(totalPages - 1, currentPage + siblingCount);

  if (leftSibling > 2) {
    tokens.push('ellipsis');
  }

  for (let page = leftSibling; page <= rightSibling; page += 1) {
    tokens.push(page);
  }

  if (rightSibling < totalPages - 1) {
    tokens.push('ellipsis');
  }

  tokens.push(totalPages);
  return tokens;
}

export default function CatalogPagination({
  meta,
  onPageChange,
  shown,
}: CatalogPaginationProps) {
  const total = meta?.total ?? 0;
  const page = meta?.page ?? 1;
  const limit = meta?.limit ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / limit) || meta?.last_page || 1);
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const rangeStart = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const rangeEnd =
    shown ?? (total === 0 ? 0 : Math.min(currentPage * limit, total));

  const pageTokens = buildPageTokens(currentPage, totalPages);
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <div className="p-6 bg-[#f0f3ff] flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-[#bec9c8]">
      <span className="text-base font-medium text-[#3f4949] text-center sm:text-left">
        {total === 0
          ? 'Sin registros'
          : `Mostrando ${rangeStart} a ${rangeEnd} de ${total} registros (Pág ${currentPage} de ${totalPages})`}
      </span>
      <div className="flex gap-2 flex-wrap justify-center items-center">
        <button
          type="button"
          disabled={isFirstPage}
          onClick={() => onPageChange(currentPage - 1)}
          className="w-12 h-12 flex items-center justify-center rounded-lg border border-[#bec9c8] hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Página anterior"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>

        {pageTokens.map((token, index) =>
          token === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              className="w-12 h-12 flex items-center justify-center text-[#6f7979] font-bold select-none"
              aria-hidden
            >
              …
            </span>
          ) : (
            <button
              key={token}
              type="button"
              onClick={() => onPageChange(token)}
              aria-current={currentPage === token ? 'page' : undefined}
              className={`w-12 h-12 flex items-center justify-center rounded-lg font-bold transition-colors ${
                currentPage === token
                  ? 'bg-[#006162] text-white'
                  : 'border border-[#bec9c8] hover:bg-white'
              }`}
            >
              {token}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={isLastPage}
          onClick={() => onPageChange(currentPage + 1)}
          className="w-12 h-12 flex items-center justify-center rounded-lg border border-[#bec9c8] hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Página siguiente"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
