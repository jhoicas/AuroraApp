import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import AIAssistedField from '../../AuroraAsistente/AIAssistedField';
import type { Project } from '../../../store/projectStore';
import {
  parsePopulationLocations,
  useProjectMgaStore,
  type PopulationLocationsData,
} from '../../../store/projectMgaStore';
import type { MgaPopulationType } from '../../../lib/mgaApi';
import MgaAccordion from './MgaAccordion';
import MgaAlert from './MgaAlert';

type PoblacionTabProps = {
  project: Project;
};

type PopulationPanelState = {
  total_number: string;
  source: string;
  municipalities: string;
  departments: string;
  localization: string;
  demographicNotes: string;
};

function emptyPanel(): PopulationPanelState {
  return {
    total_number: '',
    source: '',
    municipalities: '',
    departments: '',
    localization: '',
    demographicNotes: '',
  };
}

function panelFromRecord(
  populationType: MgaPopulationType,
  populations: ReturnType<ReturnType<typeof useProjectMgaStore.getState>['getFormulation']>['populations'],
): PopulationPanelState {
  const record = populations.find((p) => p.population_type === populationType);
  if (!record) return emptyPanel();

  const loc = parsePopulationLocations(record.locations);
  return {
    total_number: record.total_number > 0 ? String(record.total_number) : '',
    source: record.source ?? '',
    municipalities: (loc.municipalities ?? []).join(', '),
    departments: (loc.departments ?? []).join(', '),
    localization: loc.localization ?? '',
    demographicNotes: loc.demographicNotes ?? '',
  };
}

function buildLocations(panel: PopulationPanelState): PopulationLocationsData {
  const municipalities = panel.municipalities
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const departments = panel.departments
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    municipalities: municipalities.length > 0 ? municipalities : undefined,
    departments: departments.length > 0 ? departments : undefined,
    localization: panel.localization.trim() || undefined,
    demographicNotes: panel.demographicNotes.trim() || undefined,
  };
}

type PopulationPanelProps = {
  project: Project;
  populationType: MgaPopulationType;
  title: string;
  number: string;
};

function PopulationPanel({ project, populationType, title, number }: PopulationPanelProps) {
  const [open, setOpen] = useState(true);
  const [panel, setPanel] = useState<PopulationPanelState>(emptyPanel);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getFormulation = useProjectMgaStore((s) => s.getFormulation);
  const savePopulation = useProjectMgaStore((s) => s.savePopulation);
  const isSaving = useProjectMgaStore((s) => s.isSaving);

  const populations = getFormulation(project.id).populations;

  useEffect(() => {
    setPanel(panelFromRecord(populationType, populations));
  }, [populationType, populations]);

  const handleSave = async () => {
    const total = Number.parseInt(panel.total_number.replace(/\D/g, ''), 10);
    if (!Number.isFinite(total) || total <= 0) {
      setError('Indique un número total válido de personas.');
      return;
    }
    if (!panel.source.trim()) {
      setError('La fuente de la información es obligatoria.');
      return;
    }
    setError(null);
    try {
      await savePopulation(project.id, populationType, {
        total_number: total,
        source: panel.source.trim(),
        locations: buildLocations(panel),
      });
      setMessage('Población guardada correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la población');
    }
  };

  const label =
    populationType === 'afectada' ? 'población afectada' : 'población objetivo';

  return (
    <MgaAccordion number={number} title={title} open={open} onToggle={() => setOpen((v) => !v)}>
      <div className="space-y-3">
        {error && <MgaAlert message={error} onDismiss={() => setError(null)} />}
        {message && (
          <MgaAlert message={message} variant="success" onDismiss={() => setMessage(null)} />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="font-semibold text-gray-600 block mb-1">Número total</label>
            <input
              type="text"
              inputMode="numeric"
              value={panel.total_number}
              onChange={(e) => setPanel((p) => ({ ...p, total_number: e.target.value }))}
              className="w-full p-2 border rounded bg-white"
              placeholder="Ej. 15000"
            />
          </div>
          <div>
            <label className="font-semibold text-gray-600 block mb-1">Fuente</label>
            <input
              type="text"
              value={panel.source}
              onChange={(e) => setPanel((p) => ({ ...p, source: e.target.value }))}
              className="w-full p-2 border rounded bg-white"
              placeholder="Ej. DANE, censo, encuesta…"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="font-semibold text-gray-600 block mb-1">Departamentos</label>
            <input
              type="text"
              value={panel.departments}
              onChange={(e) => setPanel((p) => ({ ...p, departments: e.target.value }))}
              className="w-full p-2 border rounded bg-white"
              placeholder="Separados por coma"
            />
          </div>
          <div>
            <label className="font-semibold text-gray-600 block mb-1">Municipios</label>
            <input
              type="text"
              value={panel.municipalities}
              onChange={(e) => setPanel((p) => ({ ...p, municipalities: e.target.value }))}
              className="w-full p-2 border rounded bg-white"
              placeholder="Separados por coma"
            />
          </div>
        </div>

        <AIAssistedField
          label="Localización / territorio"
          htmlFor={`pop-loc-${populationType}-${project.id}`}
          compact
          guidance="Describa la zona geográfica donde se ubica la población: barrios, veredas, corregimientos o áreas de influencia del proyecto."
          askPrompt={`¿Cómo describo la localización de la ${label} del proyecto "${project.name}" en formulación MGA?`}
        >
          <textarea
            id={`pop-loc-${populationType}-${project.id}`}
            rows={2}
            value={panel.localization}
            onChange={(e) => setPanel((p) => ({ ...p, localization: e.target.value }))}
            className="w-full p-2 border rounded bg-white"
          />
        </AIAssistedField>

        <AIAssistedField
          label="Características demográficas"
          htmlFor={`pop-demo-${populationType}-${project.id}`}
          compact
          guidance="Incluya sexo, edad, grupo étnico, condición socioeconómica u otras variables relevantes según el manual MGA."
          askPrompt={`¿Qué características demográficas debo registrar para la ${label} del proyecto "${project.name}"?`}
        >
          <textarea
            id={`pop-demo-${populationType}-${project.id}`}
            rows={3}
            value={panel.demographicNotes}
            onChange={(e) => setPanel((p) => ({ ...p, demographicNotes: e.target.value }))}
            className="w-full p-2 border rounded bg-white"
          />
        </AIAssistedField>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="px-4 py-1.5 bg-[#2980b9] text-white font-semibold rounded disabled:opacity-60"
          >
            {isSaving ? 'Guardando…' : 'Guardar población'}
          </button>
        </div>
      </div>
    </MgaAccordion>
  );
}

export default function PoblacionTab({ project }: PoblacionTabProps) {
  return (
    <div className="space-y-4 bg-white p-4 border rounded-lg text-xs">
      <div className="flex items-center gap-2 border-b pb-3">
        <h1 className="text-xl font-normal text-[#2980b9]">Población</h1>
        <HelpCircle className="w-5 h-5 text-[#3498db]" aria-hidden />
      </div>

      <PopulationPanel
        project={project}
        populationType="afectada"
        number="01"
        title="Población afectada"
      />
      <PopulationPanel
        project={project}
        populationType="objetivo"
        number="02"
        title="Población objetivo"
      />
    </div>
  );
}
