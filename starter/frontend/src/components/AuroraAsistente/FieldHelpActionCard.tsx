import { useState } from 'react';

type FieldHelpActionCardProps = {
  displayName: string;
  whatGoesHere: string;
  whyRule: string;
  suggestedValue: string;
  onUseSuggestion: (value: string) => void;
};

/**
 * Tarjeta de sugerencia con autollenado que aparece en el popover
 * de ayuda o dentro del chat de Aurora.
 */
export default function FieldHelpActionCard({
  displayName,
  whatGoesHere,
  whyRule,
  suggestedValue,
  onUseSuggestion,
}: FieldHelpActionCardProps) {
  const [applied, setApplied] = useState(false);

  const handleApply = () => {
    onUseSuggestion(suggestedValue);
    setApplied(true);
  };

  return (
    <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-4 shadow-sm space-y-3 mt-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#006162] text-white flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-base">auto_awesome</span>
        </div>
        <p className="text-xs font-bold text-[#006162] uppercase tracking-wide">
          {displayName}
        </p>
      </div>

      {/* ¿Qué va aquí? */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-0.5">¿Qué va aquí?</p>
        <p className="text-sm text-gray-600 leading-relaxed">{whatGoesHere}</p>
      </div>

      {/* ¿Por qué? */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-0.5">¿Por qué?</p>
        <p className="text-sm text-gray-600 leading-relaxed">{whyRule}</p>
      </div>

      {/* Sugerencia resaltada */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <p className="text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">lightbulb</span>
          Sugerencia lista para usar
        </p>
        <p className="text-sm text-gray-800 leading-relaxed italic">
          &ldquo;{suggestedValue}&rdquo;
        </p>
      </div>

      {/* Botón de auto-fill */}
      <button
        type="button"
        onClick={handleApply}
        disabled={applied}
        className="w-full h-10 rounded-lg bg-[#006162] hover:bg-[#004f50] disabled:bg-emerald-700 disabled:cursor-default text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162] focus-visible:ring-offset-2"
      >
        {applied ? (
          <>
            <span className="material-symbols-outlined text-base">check_circle</span>
            Texto insertado · Puedes editarlo
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            Usar esta sugerencia en el campo
          </>
        )}
      </button>
    </div>
  );
}
