import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type {
  CauseObjectiveRelation,
  GeneralObjectiveIndicator,
} from '../../../store/projectMgaStore';

export type OfficialMGAReportData = {
  projectName: string;
  generatedAt: string;
  bpin: string;
  sector: string;
  tenantName: string;
  problemDescription: string;
  generalObjective: string;
  causeRelations: CauseObjectiveRelation[];
  generalIndicators: GeneralObjectiveIndicator[];
};

const colors = {
  primary: '#006162',
  accent: '#2980b9',
  headerBg: '#6c757d',
  border: '#dee2e6',
  muted: '#6b7280',
  text: '#1f2937',
  lightBg: '#f8f9fa',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: colors.text,
    lineHeight: 1.45,
  },
  headerBand: {
    backgroundColor: colors.primary,
    marginHorizontal: -48,
    marginTop: -40,
    paddingHorizontal: 48,
    paddingVertical: 20,
    marginBottom: 24,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#e0f2f1',
    fontSize: 11,
    marginBottom: 10,
  },
  headerMeta: {
    color: '#b2dfdb',
    fontSize: 9,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: colors.accent,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  field: {
    width: '48%',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 8,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
    fontFamily: 'Helvetica-Bold',
  },
  fieldValue: {
    fontSize: 10,
    color: colors.text,
  },
  paragraph: {
    fontSize: 10,
    textAlign: 'justify',
    padding: 10,
    backgroundColor: colors.lightBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
  },
  causeItem: {
    marginBottom: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  causeType: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  causeText: {
    fontSize: 10,
    color: colors.text,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.headerBg,
  },
  tableHeaderCell: {
    padding: 6,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#5a6268',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.lightBg,
  },
  tableCell: {
    padding: 6,
    fontSize: 9,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: colors.muted,
  },
  emptyNote: {
    fontSize: 9,
    color: colors.muted,
    fontStyle: 'italic',
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
});

function orDash(value: string | undefined | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

type OfficialMGAReportProps = {
  data: OfficialMGAReportData;
};

export default function OfficialMGAReport({ data }: OfficialMGAReportProps) {
  const directCauses = data.causeRelations.filter((c) => c.causeType === 'Causa directa');
  const indirectCauses = data.causeRelations.filter((c) => c.causeType === 'Causa indirecta');
  const otherCauses = data.causeRelations.filter(
    (c) => c.causeType !== 'Causa directa' && c.causeType !== 'Causa indirecta',
  );

  return (
    <Document
      title={`Ficha MGA - ${data.projectName}`}
      author="AuroraApp"
      subject="Formulación MGA"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBand}>
          <Text style={styles.headerTitle}>Ficha de Formulación MGA</Text>
          <Text style={styles.headerSubtitle}>{data.projectName}</Text>
          <Text style={styles.headerMeta}>Generado el {data.generatedAt}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Datos generales</Text>
          <View style={styles.grid}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Código BPIN</Text>
              <Text style={styles.fieldValue}>{orDash(data.bpin)}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Sector</Text>
              <Text style={styles.fieldValue}>{orDash(data.sector)}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Entidad territorial</Text>
              <Text style={styles.fieldValue}>{orDash(data.tenantName)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Problema central</Text>
          <Text style={styles.paragraph}>{orDash(data.problemDescription)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Causas identificadas</Text>
          {data.causeRelations.length === 0 ? (
            <Text style={styles.emptyNote}>No se registraron causas para este proyecto.</Text>
          ) : (
            <>
              {directCauses.length > 0 && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={[styles.causeType, { marginBottom: 6 }]}>Causas directas</Text>
                  {directCauses.map((cause) => (
                    <View key={cause.id} style={styles.causeItem}>
                      <Text style={styles.causeText}>{cause.causeDescription}</Text>
                    </View>
                  ))}
                </View>
              )}
              {indirectCauses.length > 0 && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={[styles.causeType, { marginBottom: 6 }]}>Causas indirectas</Text>
                  {indirectCauses.map((cause) => (
                    <View key={cause.id} style={styles.causeItem}>
                      <Text style={styles.causeText}>{cause.causeDescription}</Text>
                    </View>
                  ))}
                </View>
              )}
              {otherCauses.map((cause) => (
                <View key={cause.id} style={styles.causeItem}>
                  <Text style={styles.causeType}>{cause.causeType}</Text>
                  <Text style={styles.causeText}>{cause.causeDescription}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Objetivo general</Text>
          <Text style={styles.paragraph}>{orDash(data.generalObjective)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Objetivos específicos</Text>
          {data.causeRelations.length === 0 ? (
            <Text style={styles.emptyNote}>No se registraron objetivos específicos.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Tipo causa</Text>
                <Text style={[styles.tableHeaderCell, { width: '32%' }]}>Causa relacionada</Text>
                <Text style={[styles.tableHeaderCell, { width: '50%', borderRightWidth: 0 }]}>
                  Objetivo específico
                </Text>
              </View>
              {data.causeRelations.map((rel, index) => (
                <View
                  key={rel.id}
                  style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : undefined]}
                >
                  <Text style={[styles.tableCell, { width: '18%' }]}>{rel.causeType}</Text>
                  <Text style={[styles.tableCell, { width: '32%' }]}>{rel.causeDescription}</Text>
                  <Text style={[styles.tableCell, { width: '50%', borderRightWidth: 0 }]}>
                    {orDash(rel.specificObjective)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Indicadores del objetivo general</Text>
          {data.generalIndicators.length === 0 ? (
            <Text style={styles.emptyNote}>No se registraron indicadores de seguimiento.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '24%' }]}>Indicador</Text>
                <Text style={[styles.tableHeaderCell, { width: '16%' }]}>Medido a través de</Text>
                <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Meta</Text>
                <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Tipo fuente</Text>
                <Text style={[styles.tableHeaderCell, { width: '34%', borderRightWidth: 0 }]}>
                  Fuente de verificación
                </Text>
              </View>
              {data.generalIndicators.map((ind, index) => (
                <View
                  key={ind.id}
                  style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : undefined]}
                >
                  <Text style={[styles.tableCell, { width: '24%' }]}>{ind.indicator}</Text>
                  <Text style={[styles.tableCell, { width: '16%' }]}>{ind.measuredThrough}</Text>
                  <Text style={[styles.tableCell, { width: '12%', fontFamily: 'Helvetica-Bold' }]}>
                    {ind.target}
                  </Text>
                  <Text style={[styles.tableCell, { width: '14%' }]}>{ind.sourceType}</Text>
                  <Text style={[styles.tableCell, { width: '34%', borderRightWidth: 0 }]}>
                    {ind.verificationSource}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>AuroraApp — Módulo de Salida Oficial MGA</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
