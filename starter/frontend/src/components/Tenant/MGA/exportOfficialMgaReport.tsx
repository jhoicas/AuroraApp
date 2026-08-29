import { pdf } from '@react-pdf/renderer';
import OfficialMGAReport, { type OfficialMGAReportData } from './OfficialMGAReport';

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[^\w\s-áéíóúñÁÉÍÓÚÑ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export async function downloadOfficialMgaReport(data: OfficialMGAReportData): Promise<void> {
  const blob = await pdf(<OfficialMGAReport data={data} />).toBlob();

  const filename = `Ficha_MGA_${sanitizeFilename(data.projectName) || 'proyecto'}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildOfficialMgaReportData(params: {
  projectName: string;
  bpin?: string | null;
  sector?: string | null;
  tenantName: string;
  problemDescription?: string | null;
  generalObjective?: string | null;
  causeRelations: OfficialMGAReportData['causeRelations'];
  generalIndicators: OfficialMGAReportData['generalIndicators'];
}): OfficialMGAReportData {
  return {
    projectName: params.projectName,
    generatedAt: new Date().toLocaleString('es-CO', {
      dateStyle: 'long',
      timeStyle: 'short',
    }),
    bpin: params.bpin ?? '',
    sector: params.sector ?? '',
    tenantName: params.tenantName,
    problemDescription: params.problemDescription ?? '',
    generalObjective: params.generalObjective ?? '',
    causeRelations: params.causeRelations,
    generalIndicators: params.generalIndicators,
  };
}
