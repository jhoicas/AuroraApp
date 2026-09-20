import { useState, useEffect } from 'react';
import { useCatalogStore, type CatalogPnd } from '../../../store/catalogStore';
import { Search, X, Loader2 } from 'lucide-react';

interface PndSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (pnd: CatalogPnd) => void;
}

export default function PndSelectionModal({ isOpen, onClose, onSelect }: PndSelectionModalProps) {
  const { catalogPnd, isLoadingPnd, fetchCatalogPnd } = useCatalogStore();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      void fetchCatalogPnd({ page: 1, limit: 50, search: '' });
    }
  }, [isOpen, fetchCatalogPnd]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      void fetchCatalogPnd({ page: 1, limit: 50, search: debouncedQuery });
    }
  }, [debouncedQuery, isOpen, fetchCatalogPnd]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Buscar en el Plan Nacional de Desarrollo (PND)</h2>
            <p className="text-sm text-slate-500 mt-1">Busca por transformación, pilar, catalizador o componente</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input spellCheck={true}
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe para buscar..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-shadow outline-none text-slate-700"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoadingPnd ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-emerald-500" />
              <p>Buscando en el catálogo...</p>
            </div>
          ) : catalogPnd.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <p>No se encontraron resultados para "{query}"</p>
            </div>
          ) : (
            <div className="space-y-3">
              {catalogPnd.map((pnd) => (
                <button
                  key={pnd.id}
                  onClick={() => onSelect(pnd)}
                  className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-500/50 hover:bg-emerald-50/50 transition-all group flex flex-col gap-2"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Transformación</span>
                      <p className="text-sm text-slate-700 font-medium">{pnd.PillarDescription || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Pilar</span>
                      <p className="text-sm text-slate-700 font-medium">{pnd.ObjectiveDescription || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Catalizador</span>
                      <p className="text-sm text-slate-700 font-medium">{pnd.StrategyDescription || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Componente</span>
                      <p className="text-sm text-slate-700 font-medium">{pnd.ComponentDescription || '—'}</p>
                    </div>
                  </div>
                  <div className="w-full flex justify-end opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">
                      Seleccionar
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
