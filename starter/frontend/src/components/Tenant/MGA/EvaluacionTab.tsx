import { useState, useEffect } from 'react';
import { HelpCircle, Calculator } from 'lucide-react';
import type { Project } from '../../../store/projectStore';
import { useProjectMgaStore } from '../../../store/projectMgaStore';
import MgaAlert from './MgaAlert';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';

export type FinancialIndicators = {
  vpn: string;
  rcb: string;
  cae: string;
  vpc: string;
  tir?: string;
};

export default function EvaluacionTab({ project }: { project: Project }) {
  const formulation = useProjectMgaStore((s) => s.getFormulation(project.id));
  const saveEvaluacion = useProjectMgaStore((s) => s.saveEvaluacion);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [resumen, setResumen] = useState(formulation.evaluacion?.resumen || '');
  const [opportunityInterestRate, setOpportunityInterestRate] = useState<string>(() => {
    const raw =
      formulation.evaluacion?.opportunity_interest_rate ??
      formulation.evaluacion?.tasa_descuento ??
      (project.mga_formulation_data as any)?.evaluacion?.opportunity_interest_rate ??
      (project.mga_formulation_data as any)?.opportunity_interest_rate ??
      12;
    return String(raw);
  });

  const alternatives = formulation.alternatives.filter((a) => a.proceeds_to_preparation);

  const [indicadores, setIndicadores] = useState<Record<string, FinancialIndicators>>({});

  useEffect(() => {
    const evalData = formulation.evaluacion || (project.mga_formulation_data as any)?.evaluacion || {};
    if (evalData.resumen) setResumen(evalData.resumen);
    if (evalData.opportunity_interest_rate !== undefined) {
      setOpportunityInterestRate(String(evalData.opportunity_interest_rate));
    }

    const savedInds = evalData.indicadores || {};
    const initialMap: Record<string, FinancialIndicators> = {};

    alternatives.forEach((alt) => {
      const existing = savedInds[alt.id] || {};
      initialMap[alt.id] = {
        vpn: existing.vpn !== undefined ? String(existing.vpn) : (evalData.vpn !== undefined ? String(evalData.vpn) : '15000000'),
        rcb: existing.rcb !== undefined ? String(existing.rcb) : (evalData.rcb !== undefined ? String(evalData.rcb) : '1.35'),
        cae: existing.cae !== undefined ? String(existing.cae) : (evalData.cae !== undefined ? String(evalData.cae) : '4500000'),
        vpc: existing.vpc !== undefined ? String(existing.vpc) : (evalData.vpc !== undefined ? String(evalData.vpc) : '120000000'),
        tir: existing.tir !== undefined ? String(existing.tir) : (evalData.tir !== undefined ? String(evalData.tir) : '15.5'),
      };
    });

    setIndicadores(initialMap);
  }, [formulation.evaluacion, formulation.alternatives]);

  const updateIndicator = (altId: string, field: keyof FinancialIndicators, value: string) => {
    setIndicadores((prev) => ({
      ...prev,
      [altId]: {
        ...prev[altId],
        [field]: value,
      },
    }));
  };

  const fieldProjectContext = {
    projectName: project.name,
    sector: project.sector || undefined,
    productCode: project.product_code || undefined,
  };

  const handleSave = async () => {
    setError(null);
    setMessage(null);
    const numRate = parseFloat(opportunityInterestRate) || 12;
    const firstAlt = alternatives[0]?.id;
    const firstInd = firstAlt ? indicadores[firstAlt] : null;

    try {
      await saveEvaluacion(project.id, {
        resumen,
        opportunity_interest_rate: numRate,
        tasa_descuento: numRate,
        indicadores,
        vpn: firstInd ? parseFloat(firstInd.vpn) || 0 : (formulation.evaluacion?.vpn || 0),
        rcb: firstInd ? parseFloat(firstInd.rcb) || 0 : (formulation.evaluacion?.rcb || 0),
        cae: firstInd ? parseFloat(firstInd.cae) || 0 : (formulation.evaluacion?.cae || 0),
        vpc: firstInd ? parseFloat(firstInd.vpc) || 0 : (formulation.evaluacion?.vpc || 0),
        tir: firstInd?.tir ? parseFloat(firstInd.tir) || 0 : (formulation.evaluacion?.tir || 0),
      });
      setMessage('Evaluación económica guardada exitosamente.');
    } catch (err) {
      setError('Error al guardar evaluación');
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-sm">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Evaluación Económica y Social</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
      {message && <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />}

      {/* Tasa de Oportunidad / Descuento */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-2">
        <label className="font-semibold text-gray-700 block">
          Tasa de interés de oportunidad / descuento (%) *
        </label>
        <p className="text-xs text-gray-500">
          Tasa social de descuento oficial establecida por el DNP para evaluar la rentabilidad económica y social de proyectos públicos (por defecto 12% MGA).
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            id={`eval-rate-${project.id}`}
            name="opportunity_interest_rate"
            value={opportunityInterestRate}
            onChange={(e) => setOpportunityInterestRate(e.target.value)}
            className="w-36 p-2 border rounded text-xs bg-white focus:ring-2 focus:ring-primary font-semibold"
            placeholder="12"
          />
          <span className="text-xs text-gray-600 font-semibold">% Tasa Social de Descuento (DNP)</span>
        </div>
      </div>

      <div className="space-y-4">
        {alternatives.length === 0 ? (
          <div className="p-4 text-center text-gray-500 border rounded bg-gray-50">
            No hay alternativas para evaluar. Debe registrar al menos una alternativa que pase a preparación.
          </div>
        ) : (
          <div className="border rounded p-4 bg-gray-50 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">Indicadores financieros y económicos por alternativa</h3>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5" /> Metodología DNP MGA
              </span>
            </div>
            
            <div className="overflow-x-auto border rounded bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#6c757d] text-white">
                  <tr>
                    <th className="p-2 border">Alternativa</th>
                    <th className="p-2 border">VPN ($ COP)</th>
                    <th className="p-2 border">RCB (Relación C/B)</th>
                    <th className="p-2 border">CAE ($ COP)</th>
                    <th className="p-2 border">VPC ($ COP)</th>
                    <th className="p-2 border">TIR (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {alternatives.map((alt) => {
                    const ind = indicadores[alt.id] || { vpn: '0', rcb: '1', cae: '0', vpc: '0', tir: '0' };
                    return (
                      <tr key={alt.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 border font-medium text-gray-800 max-w-[200px]">
                          {alt.description}
                        </td>
                        <td className="p-2 border">
                          <input
                            type="number"
                            step="any"
                            value={ind.vpn}
                            onChange={(e) => updateIndicator(alt.id, 'vpn', e.target.value)}
                            className="w-full p-1 border rounded bg-white font-mono text-xs"
                            placeholder="VPN"
                          />
                        </td>
                        <td className="p-2 border">
                          <input
                            type="number"
                            step="0.01"
                            value={ind.rcb}
                            onChange={(e) => updateIndicator(alt.id, 'rcb', e.target.value)}
                            className="w-full p-1 border rounded bg-white font-mono text-xs"
                            placeholder="RCB"
                          />
                        </td>
                        <td className="p-2 border">
                          <input
                            type="number"
                            step="any"
                            value={ind.cae}
                            onChange={(e) => updateIndicator(alt.id, 'cae', e.target.value)}
                            className="w-full p-1 border rounded bg-white font-mono text-xs"
                            placeholder="CAE"
                          />
                        </td>
                        <td className="p-2 border">
                          <input
                            type="number"
                            step="any"
                            value={ind.vpc}
                            onChange={(e) => updateIndicator(alt.id, 'vpc', e.target.value)}
                            className="w-full p-1 border rounded bg-white font-mono text-xs"
                            placeholder="VPC"
                          />
                        </td>
                        <td className="p-2 border">
                          <input
                            type="number"
                            step="0.1"
                            value={ind.tir || ''}
                            onChange={(e) => updateIndicator(alt.id, 'tir', e.target.value)}
                            className="w-full p-1 border rounded bg-white font-mono text-xs"
                            placeholder="TIR %"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <AIAssistedField
                label="Conclusión / Resumen de Evaluación"
                htmlFor={`eval-resumen-${project.id}`}
                compact
                guidance="Escribe las conclusiones de la evaluación económica y social."
                askPrompt={`¿Cómo redacto las conclusiones de la evaluación económica para el proyecto "${project.name}"?`}
                fieldHelpKey="resumen_evaluacion"
                projectContext={fieldProjectContext}
                reactiveContext={{ resumen, opportunityInterestRate }}
                currentValue={resumen}
                onAutoFill={(v) => setResumen(v)}
                maxLength={2500}
              >
                <textarea spellCheck={true}
                  id={`eval-resumen-${project.id}`}
                  rows={4}
                  maxLength={2500}
                  value={resumen}
                  onChange={(e) => setResumen(e.target.value)}
                  className="w-full p-2 border rounded bg-white mt-1 text-xs"
                  placeholder="Escriba las conclusiones de la evaluación conforme a los indicadores calculados..."
                />
              </AIAssistedField>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
        <button 
          type="button"
          onClick={() => void handleSave()} 
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          Guardar Evaluación
        </button>
      </div>
    </div>
  );
}
