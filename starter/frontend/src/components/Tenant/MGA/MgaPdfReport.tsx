import { forwardRef, useMemo } from 'react';
import { LogoAurora } from '../../LogoAurora';
import type { Project } from '../../../store/projectStore';
import type { ProjectMgaFormulation } from '../../../store/projectMgaStore';
import type { ProjectEdtChainState } from '../../../store/projectEdtStore';
import { groupCausesByParent, groupEffectsByParent } from './mgaProblemTree';
import { buildMgaLogicMatrix } from './mgaReportMatrix';

export type MgaPdfReportMeta = {
  printedAt: string;
  formuladorLabel: string;
  formuladorType: string;
  tenantName?: string;
};

export type MgaPdfReportProps = {
  project: Project;
  formulation: ProjectMgaFormulation;
  edtChain: ProjectEdtChainState;
  meta: MgaPdfReportMeta;
};

function orDash(value: string | undefined | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="mb-4 print-exact-colors print:break-inside-avoid">
      <div className="rounded-md bg-primary px-4 py-2.5 text-white shadow-sm print:bg-primary">
        <h2 className="font-headline text-sm font-bold tracking-wide">
          <span className="mr-2 opacity-90">{number}</span>
          {title}
        </h2>
      </div>
    </div>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-surface-container-lowest p-4 print:break-inside-avoid">
      <dt className="mb-1 text-[10px] font-bold uppercase tracking-wider text-outline">{label}</dt>
      <dd className="text-sm font-medium leading-snug text-gray-800">{value}</dd>
    </div>
  );
}

const MgaPdfReport = forwardRef<HTMLDivElement, MgaPdfReportProps>(function MgaPdfReport(
  { project, formulation, edtChain, meta },
  ref,
) {
  const matrixRows = useMemo(
    () =>
      buildMgaLogicMatrix({
        generalObjective: project.general_objective ?? '',
        formulation,
        edtChain,
      }),
    [edtChain, formulation, project.general_objective],
  );

  const effectGroups = useMemo(
    () => groupEffectsByParent(formulation.effects),
    [formulation.effects],
  );
  const causeGroups = useMemo(
    () => groupCausesByParent(formulation.causeRelations),
    [formulation.causeRelations],
  );

  const tipologia = edtChain.catalogLink?.tipologia?.trim() || '—';
  const isTipoProject = edtChain.catalogLink?.product_code ? 'Sí' : 'No';

  return (
    <div
      ref={ref}
      className="print-exact-colors w-[210mm] min-h-[297mm] bg-white p-8 font-body text-gray-800"
    >
      <header className="mb-8 border-b-2 border-primary/20 pb-6 print:break-inside-avoid">
        <div className="mb-6 flex items-start justify-between gap-6">
          <LogoAurora className="h-10 w-10 text-primary" />
          <div className="text-right text-xs text-outline">
            <p className="font-semibold uppercase tracking-wide text-primary">Ficha MGA</p>
            <p className="mt-1">Impresión: {meta.printedAt}</p>
            {meta.tenantName && <p className="mt-0.5">{meta.tenantName}</p>}
          </div>
        </div>
        <h1 className="font-headline text-2xl font-bold leading-tight text-primary">
          Resumen del Proyecto — Metodología General Ajustada
        </h1>
        <p className="mt-2 text-sm text-outline">
          Documento de formulación para inversión pública · AuroraApp
        </p>
      </header>

      <section className="mb-8">
        <SectionHeading number="01" title="Datos básicos" />
        <p className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-base font-bold uppercase tracking-wide text-primary print:break-inside-avoid">
          {project.name.trim() || 'Proyecto sin título'}
        </p>
        <dl className="grid grid-cols-2 gap-3">
          <DataField label="Tipología PIIP" value={tipologia} />
          <DataField label="Código BPIN" value={orDash(project.code_bpin)} />
          <DataField label="Sector" value={orDash(project.sector)} />
          <DataField label="Es proyecto tipo" value={isTipoProject} />
          <DataField
            label="Formulador"
            value={`${meta.formuladorType} — ${orDash(meta.formuladorLabel)}`}
          />
          <DataField label="Fecha de creación" value={formatDate(project.created_at)} />
        </dl>
      </section>

      <section className="mb-8">
        <SectionHeading number="02" title="Identificación / Plan de desarrollo" />
        <div className="space-y-4">
          <article className="rounded-lg border border-gray-200 p-4 print:break-inside-avoid">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
              Descripción del problema central
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {orDash(project.problem_description)}
            </p>
          </article>
          <article className="rounded-lg border border-gray-200 p-4 print:break-inside-avoid">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
              Objetivo general
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {orDash(project.general_objective)}
            </p>
          </article>
          {(effectGroups.length > 0 || causeGroups.length > 0) && (
            <article className="rounded-lg border border-gray-200 p-4 print:break-inside-avoid">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-primary">
                Árbol de problemas (resumen)
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="mb-2 font-semibold text-gray-700">Efectos</p>
                  <ul className="list-disc space-y-1 pl-4 text-gray-700">
                    {formulation.effects.length === 0 && <li>—</li>}
                    {formulation.effects.map((effect) => (
                      <li key={effect.id}>{effect.description}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 font-semibold text-gray-700">Causas</p>
                  <ul className="list-disc space-y-1 pl-4 text-gray-700">
                    {formulation.causeRelations.length === 0 && <li>—</li>}
                    {formulation.causeRelations.map((cause) => (
                      <li key={cause.id}>{cause.causeDescription}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          )}
        </div>
      </section>

      <section className="mb-6">
        <SectionHeading number="03" title="Resumen del proyecto (Matriz de marco lógico / Cadena de valor)" />
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-primary-container text-left text-white print-exact-colors print:bg-primary-container">
                <th className="w-[22%] border-b border-gray-200 p-4 text-xs font-bold uppercase tracking-wide">
                  Resumen narrativo
                </th>
                <th className="w-[26%] border-b border-l border-gray-200 p-4 text-xs font-bold uppercase tracking-wide">
                  Indicadores
                </th>
                <th className="w-[26%] border-b border-l border-gray-200 p-4 text-xs font-bold uppercase tracking-wide">
                  Fuentes de verificación
                </th>
                <th className="w-[26%] border-b border-l border-gray-200 p-4 text-xs font-bold uppercase tracking-wide">
                  Supuestos
                </th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row, index) => {
                const isObjective = row.level === 'objective';
                const isProduct = row.level === 'product';
                const indent =
                  row.level === 'activity' ? 'pl-8' : row.level === 'product' ? 'pl-4' : 'pl-0';

                return (
                  <tr
                    key={row.id}
                    className={`print:break-inside-avoid ${
                      index % 2 === 0 ? 'bg-white' : 'bg-surface-container-low/60'
                    } ${isObjective ? 'bg-primary/5' : ''}`}
                  >
                    <td className={`border-t border-gray-200 p-4 align-top ${indent}`}>
                      <p
                        className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${
                          isObjective ? 'text-primary' : isProduct ? 'text-primary-container' : 'text-outline'
                        }`}
                      >
                        {row.hierarchyLabel}
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed text-gray-800">{row.narrative}</p>
                    </td>
                    <td className="border-t border-l border-gray-200 p-4 align-top whitespace-pre-wrap text-gray-700">
                      {row.indicators}
                    </td>
                    <td className="border-t border-l border-gray-200 p-4 align-top whitespace-pre-wrap text-gray-700">
                      {row.verificationSources}
                    </td>
                    <td className="border-t border-l border-gray-200 p-4 align-top whitespace-pre-wrap text-gray-700">
                      {row.assumptions}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-8 border-t border-gray-200 pt-4 text-xs text-outline print:break-inside-avoid">
        <p>
          Generado por AuroraApp · Estado del proyecto: {orDash(project.status)} ·{' '}
          {meta.printedAt}
        </p>
      </footer>
    </div>
  );
});

export default MgaPdfReport;
