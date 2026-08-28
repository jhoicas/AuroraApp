import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type ComboboxOption = {
  value: string;
  label: string;
  code?: string;
  /** Texto secundario opcional (descripción, subprograma, etc.). */
  hint?: string;
};

type SearchableComboboxProps = {
  id?: string;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(option: ComboboxOption, rawQuery: string): boolean {
  const query = normalizeText(rawQuery);
  if (!query) return true;

  const code = normalizeText(option.code ?? option.value);
  const label = normalizeText(option.label);
  const hint = normalizeText(option.hint ?? '');
  const combined = `${code} ${label} ${hint}`;

  return (
    code.includes(query) ||
    code.startsWith(query) ||
    label.includes(query) ||
    combined.includes(query)
  );
}

function formatOptionLabel(option: ComboboxOption): string {
  const code = option.code ?? option.value;
  return `${code} — ${option.label}`;
}

/**
 * Combobox con búsqueda en tiempo real por código o texto.
 * Filtrado en cliente sobre la lista completa recibida del API.
 */
export default function SearchableCombobox({
  id,
  label,
  placeholder = 'Buscar por código o nombre…',
  disabled = false,
  loading = false,
  loadingMessage = 'Cargando opciones…',
  emptyMessage = 'No hay opciones disponibles.',
  noResultsMessage = 'Sin coincidencias. Pruebe con otro código o texto.',
  options,
  value,
  onChange,
}: SearchableComboboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listboxId = `${inputId}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filtered = useMemo(
    () => options.filter((option) => matchesQuery(option, query)),
    [options, query],
  );

  const isInteractive = !disabled && !loading;

  const displayValue = loading
    ? ''
    : open
      ? query
      : selected
        ? formatOptionLabel(selected)
        : '';

  useEffect(() => {
    if (!value) {
      setQuery('');
      setOpen(false);
    }
  }, [value]);

  useEffect(() => {
    if (disabled || loading) {
      setOpen(false);
      setQuery('');
    }
  }, [disabled, loading]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
  };

  return (
    <div ref={containerRef} className="relative block space-y-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-gray-700">
        {label}
      </label>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {loading ? (
            <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-xl">search</span>
          )}
        </span>

        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-busy={loading}
          autoComplete="off"
          disabled={disabled || loading}
          value={displayValue}
          placeholder={loading ? loadingMessage : placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) {
              onChange('');
            }
          }}
          onFocus={() => {
            if (isInteractive) {
              setOpen(true);
            }
          }}
          className="w-full h-12 rounded-lg border-2 border-gray-200 bg-white pl-10 pr-10 text-gray-900 placeholder:text-gray-400 focus:border-[#006162] focus:outline-none focus:ring-4 focus:ring-[#006162]/10 transition-all disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
        />

        {value && isInteractive && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Limpiar selección"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}

        {open && isInteractive && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">{noResultsMessage}</li>
            ) : (
              filtered.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelect(option.value)}
                      className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition hover:bg-teal-50 ${
                        isSelected ? 'bg-teal-50/80 text-[#006162]' : 'text-gray-800'
                      }`}
                    >
                      <span className="font-medium">{formatOptionLabel(option)}</span>
                      {option.hint && (
                        <span className="line-clamp-2 text-xs text-gray-500">{option.hint}</span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {loading && (
        <p className="text-xs text-[#006162] inline-flex items-center gap-1.5 font-medium">
          <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
          {loadingMessage}
        </p>
      )}
    </div>
  );
}
