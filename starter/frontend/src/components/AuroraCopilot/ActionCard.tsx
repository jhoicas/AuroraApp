import type { ActionCardPayload } from '../../store/auroraCopilotStore';

type ActionCardProps = {
  card: ActionCardPayload;
  onApply: (card: ActionCardPayload) => void;
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

export default function ActionCard({ card, onApply }: ActionCardProps) {
  return (
    <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#006162] text-white flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-xl">inventory_2</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-[#006162] font-bold mb-0.5">
            {catalogLabels[card.catalog] ?? card.catalog}
          </p>
          <p className="font-semibold text-gray-900 text-sm leading-snug">{card.label}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">Código: {card.code}</p>
          {card.description && (
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{card.description}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onApply(card)}
        className="mt-3 w-full h-9 rounded-lg bg-[#006162] hover:bg-[#004f50] text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] focus-visible:ring-offset-2"
      >
        Aplicar
      </button>
    </div>
  );
}
