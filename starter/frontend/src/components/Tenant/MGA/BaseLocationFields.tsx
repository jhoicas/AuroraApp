import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ProjectBaseLocation } from '../../../lib/projectBaseLocation';

export type BaseLocationOption = { id: number; label: string };

type BaseLocationFieldsProps = {
  /** Prefijo de ids únicos de los selects (ej. `poblacion-afectada`). */
  idPrefix: string;
  base: ProjectBaseLocation;
  regionName?: string | null;
  departamentoName?: string | null;
  /** Solo municipios del departamento base (el filtrado lo hace quien llama). */
  municipioOptions: BaseLocationOption[];
  municipioId: number | null;
  onMunicipioChange: (municipioId: number | null) => void;
  labels?: { region?: ReactNode; departamento?: ReactNode; municipio?: ReactNode };
  labelClassName?: string;
  selectClassName?: string;
  /** Clases del contenedor de la grilla. */
  className?: string;
  /** Mensaje bajo los campos bloqueados. `null` lo oculta. */
  lockedHint?: string | null;
};

const DEFAULT_LABEL = 'block text-xs font-semibold text-slate-700 mb-1';
const DEFAULT_SELECT = 'w-full p-2 border rounded focus:ring-1 focus:ring-[#006162] outline-none text-sm bg-white';
const LOCKED_SELECT = 'bg-slate-100 text-slate-600 cursor-not-allowed';
const HINT = 'Fijado por el departamento base del proyecto.';

/**
 * Selectores de ubicación con la regla de localización estricta: Región y Departamento aparecen
 * preseleccionados con la base del proyecto y bloqueados (solo lectura); Municipio solo ofrece los
 * municipios de ese departamento. Reutilizable en cualquier formulario que agregue localizaciones.
 */
export default function BaseLocationFields({
  idPrefix,
  base,
  regionName,
  departamentoName,
  municipioOptions,
  municipioId,
  onMunicipioChange,
  labels,
  labelClassName = DEFAULT_LABEL,
  selectClassName = DEFAULT_SELECT,
  className = 'grid grid-cols-1 md:grid-cols-3 gap-3',
  lockedHint = HINT,
}: BaseLocationFieldsProps) {
  const lockedClass = `${selectClassName} ${LOCKED_SELECT}`;
  const regionId = base.regionId;

  return (
    <div>
      <div className={className}>
        <div>
          <label htmlFor={`${idPrefix}-region`} className={labelClassName}>
            {labels?.region ?? 'Región'} <Lock className="inline w-3 h-3 text-slate-400" aria-hidden />
          </label>
          <select
            id={`${idPrefix}-region`}
            value={regionId !== null ? String(regionId) : ''}
            disabled
            aria-readonly
            title={HINT}
            className={lockedClass}
          >
            <option value={regionId !== null ? String(regionId) : ''}>
              {regionName ?? (regionId !== null ? `Región ${regionId}` : 'Región del departamento base')}
            </option>
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-departamento`} className={labelClassName}>
            {labels?.departamento ?? 'Departamento'} <Lock className="inline w-3 h-3 text-slate-400" aria-hidden />
          </label>
          <select
            id={`${idPrefix}-departamento`}
            value={String(base.departamentoId)}
            disabled
            aria-readonly
            title={HINT}
            className={lockedClass}
          >
            <option value={String(base.departamentoId)}>
              {departamentoName ?? `Departamento ${base.departamentoId}`}
            </option>
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-municipio`} className={labelClassName}>
            {labels?.municipio ?? 'Municipio'}
          </label>
          <select
            id={`${idPrefix}-municipio`}
            value={municipioId !== null ? String(municipioId) : ''}
            onChange={(e) => onMunicipioChange(e.target.value ? Number(e.target.value) : null)}
            disabled={municipioOptions.length === 0}
            className={`${selectClassName} disabled:bg-slate-100 disabled:text-slate-400`}
          >
            <option value="">
              {municipioOptions.length === 0 ? 'Cargando municipios...' : 'Seleccione Municipio...'}
            </option>
            {municipioOptions.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {lockedHint && <p className="mt-1 text-[11px] text-slate-500">{lockedHint}</p>}
    </div>
  );
}
