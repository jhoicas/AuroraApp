import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  useAuroraCopilotStore,
  registerAutoFillCallback,
} from '../../store/auroraCopilotStore';
import { validateInfinitiveObjective } from '../../lib/mgaObjectiveValidation';
import { getFieldKnowledge, type ProjectContext } from '../../data/mgaFieldsKnowledge';

type AIAssistedFieldProps = {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  /** Guía metodológica breve mostrada en el popover. */
  guidance?: string;
  /** Prompt inyectado al abrir Aurora Asistente (modo chat completo). */
  askPrompt?: string;
  /** Valor actual para validación normativa en pantalla. */
  validationValue?: string;
  /** Regla de validación MGA aplicada bajo el campo. */
  validationRule?: 'infinitive-verb';
  children: ReactNode;
  className?: string;
  /** Estilo compacto para tablas Modo MGA. */
  compact?: boolean;
  /** Clave del campo en el catálogo de conocimiento MGA. */
  fieldHelpKey?: string;
  /** Contexto del proyecto para generar sugerencias contextualizadas. */
  projectContext?: ProjectContext;
  /** Callback para insertar el valor sugerido directamente en el campo. */
  onAutoFill?: (value: string) => void;
  /** Contexto reactivo para disparar sugerencias automáticas (debounce) */
  reactiveContext?: Record<string, any>;
  /** Valor actual del input. Si está vacío y el reactiveContext cambia, pide sugerencia. */
  currentValue?: string;
  /** Textos sugeridos por la IA en fases previas (ej: ideación). */
  prefilledSuggestions?: string[];
  /** Callback a ejecutar cuando se usa una sugerencia prellenada. */
  onApplySuggestion?: (value: string) => void;
  /** Longitud máxima de la respuesta sugerida por la IA. */
  maxLength?: number;
  /** Indica si el campo es un select/dropdown (requiere formato CODIGO|||Explicacion). */
  isList?: boolean;
  /** Opciones del catálogo si isList es true. */
  options?: { label: string; value: string }[];
};

/**
 * Envuelve un campo de formulario con ayuda contextual y CTA hacia Aurora Asistente.
 */
export default function AIAssistedField({
  label,
  htmlFor,
  required = false,
  guidance,
  askPrompt,
  validationValue = '',
  validationRule,
  children,
  className = '',
  compact = false,
  fieldHelpKey,
  projectContext,
  reactiveContext,
  currentValue,
  onAutoFill,
  prefilledSuggestions,
  onApplySuggestion,
  maxLength,
  isList,
  options,
}: AIAssistedFieldProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askAurora = useAuroraCopilotStore((s) => s.askAurora);
  const askFieldHelp = useAuroraCopilotStore((s) => s.askFieldHelp);
  const suggestMgaField = useAuroraCopilotStore((s) => s.suggestMgaField);
  const storeSuggestions = useAuroraCopilotStore((s) => fieldHelpKey ? s.mgaFieldSuggestions[fieldHelpKey] : null);

  // Eliminado el auto-fetch masivo:
  // Se disparará solo onFocus o onClick en "Sugerir con Aurora"

  const activeSuggestions = prefilledSuggestions || storeSuggestions;

  // Register auto-fill callback so the chat ActionCard can dispatch back
  useEffect(() => {
    if (fieldHelpKey && onAutoFill) {
      return registerAutoFillCallback(fieldHelpKey, onAutoFill);
    }
  }, [fieldHelpKey, onAutoFill]);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  const fieldKnowledge = fieldHelpKey ? getFieldKnowledge(fieldHelpKey) : null;



  const handleAskFieldHelp = () => {
    if (fieldHelpKey) {
      askFieldHelp(fieldHelpKey, projectContext ?? {});
    } else {
      askAurora(askPrompt || '');
    }
    setOpen(false);
  };

  const validationMessage =
    validationRule === 'infinitive-verb' ? validateInfinitiveObjective(validationValue) : null;

  return (
    <div className={`relative ${className}`}>
      <div className={`flex items-center gap-1.5 ${compact ? 'mb-0.5' : 'mb-1'}`}>
        <label
          htmlFor={htmlFor}
          className={`block font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}
        >
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
        <div
          className="relative"
          onMouseEnter={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
        >
          <button
            type="button"
            aria-label={`Ayuda metodológica: ${label}`}
            aria-expanded={open}
            aria-controls={tipId}
            onClick={() => {
              clearCloseTimer();
              setOpen((v) => !v);
            }}
            onBlur={(e) => {
              if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                setOpen(false);
              }
            }}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[#006162] hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006162]/40 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          </button>

          {open && (
            <div
              id={tipId}
              role="tooltip"
              className="absolute left-0 top-full mt-2 z-40 w-72 sm:w-80 rounded-xl border border-gray-200 bg-white p-3.5 shadow-xl shadow-gray-900/10"
            >
              <p className="text-xs font-semibold text-[#006162] mb-1.5 inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">lightbulb</span>
                Guía metodológica
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">{guidance}</p>

              {/* Pattern hint from knowledge catalog */}
              {fieldKnowledge && (
                <p className="text-xs text-gray-500 mb-3 italic">
                  Patrón: {fieldKnowledge.templatePattern}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (fieldHelpKey && projectContext && reactiveContext) {
                      suggestMgaField(fieldHelpKey, { ...projectContext, ...reactiveContext }, maxLength, isList, options);
                      setOpen(false);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors bg-teal-100 hover:bg-teal-200 text-teal-800`}
                >
                  <span className="material-symbols-outlined text-sm">magic_button</span>
                  Sugerir con Aurora
                </button>
                {/* Secondary: Open chat with field-help */}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleAskFieldHelp}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors bg-[#006162] hover:bg-[#004f50] text-white`}
                >
                  <span className="material-symbols-outlined text-sm">chat</span>
                  Preguntar a Aurora
                </button>
              </div>

              <span
                className="absolute -top-1.5 left-3 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45"
                aria-hidden
              />
            </div>
          )}
        </div>
        
        {activeSuggestions && activeSuggestions.length > 0 && (
          <span className="ml-1 inline-flex flex-wrap items-center text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 gap-x-2 gap-y-1">
            ✨
            {activeSuggestions.map((sug, i) => {
              if (sug === "CARGANDO") {
                return (
                  <span key={i} className="inline-flex items-center text-teal-600 font-medium ml-1 italic animate-pulse">
                    <span className="material-symbols-outlined text-[14px] mr-1 animate-spin">sync</span>
                    Generando sugerencia...
                  </span>
                );
              }
              if (sug === "ESPERANDO_CUOTA") {
                return (
                  <span key={i} className="inline-flex items-center text-amber-600 font-medium ml-1">
                    ⏳ Límite alcanzado. Esperando para procesar sugerencia...
                  </span>
                );
              }

              let displayValue = sug;
              let applyValue = sug;

              if (sug.includes('|||')) {
                const parts = sug.split('|||');
                applyValue = parts[0].trim();
                displayValue = parts.slice(1).join('|||').trim();
              }

              return (
                <span key={i} className="inline-flex items-center">
                  <span className="truncate max-w-[300px]" title={displayValue}>{displayValue}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      const finalValue = maxLength ? applyValue.substring(0, maxLength) : applyValue;
                      onApplySuggestion?.(finalValue);
                      onAutoFill?.(finalValue);
                    }}
                    className="ml-1 font-semibold hover:underline text-[#006162]"
                  >
                    [Usar]
                  </button>
                  {i < activeSuggestions.length - 1 && <span className="ml-2 text-teal-300">|</span>}
                </span>
              );
            })}
          </span>
        )}
      </div>
      <div
        onFocusCapture={() => {
          // Trigger bajo demanda cuando se hace Focus y está vacío
          if (!currentValue && fieldHelpKey && projectContext && reactiveContext && !storeSuggestions) {
            suggestMgaField(fieldHelpKey, { ...projectContext, ...reactiveContext }, maxLength, isList, options);
          }
        }}
      >
        {children}
      </div>
      {validationMessage && (
        <p role="alert" className="mt-1 text-xs text-amber-700 font-medium">
          {validationMessage}
        </p>
      )}

    </div>
  );
}
