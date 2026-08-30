import { useState } from 'react';
import type { ActionCardPayload } from '../../store/auroraCopilotStore';

type ActionCardProps = {
  card: ActionCardPayload;
  onApply: (card: ActionCardPayload) => Promise<void> | void;
};

const catalogLabels: Record<string, string> = {
  ods: 'ODS',
  products: 'Producto DNP',
  sectors: 'Sector',
  programs: 'Programa',
  edt: 'EDT',
  deliverables: 'Entregable',
  activities: 'Actividad',
};

const typeLabels: Record<string, string> = {
  mga_apply: 'Sugerencia MGA',
  catalog_search: 'Catálogo DNP',
  navigate: 'Navegación',
};

function cardKind(card: ActionCardPayload): string {
  if (card.type === 'mga_apply') return 'mga_apply';
  if (card.type === 'navigate') return 'navigate';
  if (card.catalog) return card.catalog;
  return 'action';
}

function cardIcon(kind: string): string {
  if (kind === 'mga_apply') return 'auto_fix_high';
  if (kind === 'navigate') return 'open_in_new';
  return 'inventory_2';
}

export default function ActionCard({ card, onApply }: ActionCardProps) {
  const [status, setStatus] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const kind = cardKind(card);
  const badge =
    card.type && typeLabels[card.type]
      ? typeLabels[card.type]
      : catalogLabels[card.catalog ?? ''] ?? 'Acción sugerida';

  const buttonLabel =
    status === 'applied'
      ? '✓ Aplicado'
      : status === 'applying'
        ? 'Aplicando…'
        : card.label || 'Aplicar';

  const handleClick = async () => {
    if (status === 'applied' || status === 'applying') return;
    setStatus('applying');
    setErrorMessage(null);
    try {
      await onApply(card);
      setStatus('applied');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'No se pudo aplicar la acción');
    }
  };

  return (
    <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#006162] text-white flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-xl">{cardIcon(kind)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-[#006162] font-bold mb-0.5">
            {badge}
          </p>
          {card.type === 'mga_apply' && card.payload?.field ? (
            <p className="text-xs text-gray-500 font-mono mb-0.5">
              Campo: {String(card.payload.field)}
            </p>
          ) : null}
          {card.code ? (
            <>
              {card.description ? (
                <p className="font-semibold text-gray-900 text-sm leading-snug">{card.description}</p>
              ) : (
                <p className="font-semibold text-gray-900 text-sm leading-snug">{card.label}</p>
              )}
              <p className="text-xs text-gray-500 font-mono mt-0.5">Código: {card.code}</p>
            </>
          ) : (
            <p className="font-semibold text-gray-900 text-sm leading-snug">{card.label}</p>
          )}
          {card.description && card.code ? null : card.description ? (
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{card.description}</p>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={status === 'applied' || status === 'applying'}
        className="mt-3 w-full h-9 rounded-lg bg-[#006162] hover:bg-[#004f50] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] focus-visible:ring-offset-2"
      >
        {buttonLabel}
      </button>
      {errorMessage && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
