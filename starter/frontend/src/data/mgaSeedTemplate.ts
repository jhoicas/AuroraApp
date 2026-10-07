import type {
  ActividadCvJson,
  CostoCvJson,
  IdentificacionData,
  IndicadorProductoProgramado,
  PlanDesarrolloData,
  PreparacionData,
  ProductoCvJson,
  ProgramacionData,
  RiesgoJson,
} from '../store/projectMgaStore';

/**
 * Plantillas de proyectos MGA.
 *
 * Una plantilla es un snapshot completo de `mga_formulation_data` más los campos de texto del proyecto
 * (problema, objetivo general, situación y magnitud). Las plantillas del sistema (`isSystem`) son
 * inmutables: no se pueden eliminar desde la UI ni desde el store.
 */

export type TemplateParticipant = {
  id: string;
  actor_id: number;
  entity_id: number | null;
  position_id: number;
  otro_participante: string | null;
  interests: string;
  contribution: string;
};

export type TemplateFormulation = {
  identificacion: IdentificacionData;
  planDesarrollo: PlanDesarrolloData;
  participants: TemplateParticipant[];
  preparacion: PreparacionData;
  programacion: ProgramacionData;
  evaluacion: { alternativaSeleccionadaId: string };
};

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  sector: string;
  /** Plantilla del sistema/semilla: protegida contra eliminación. */
  isSystem: boolean;
  /** Tenant propietario de una plantilla personalizada (las del sistema no tienen). */
  tenantId?: string | null;
  /** Texto sugerido para el "objeto" del proyecto al clonar. */
  objeto: string;
  problem_description: string;
  general_objective: string;
  situacion_existente: string;
  magnitud_problema: string;
  formulation: TemplateFormulation;
  createdAt: string;
};

export const MGA_SEED_TEMPLATE_ID = 'system-mga-agro-productividad';

// ─── Identificadores internos (se re-generan al clonar) ─────────────────────

const ALT_ID = 'alt-seed-1';

const EFECTO_DIRECTO_1 = 'efd-seed-1';
const EFECTO_DIRECTO_2 = 'efd-seed-2';
const CAUSA_DIRECTA_1 = 'cad-seed-1';
const CAUSA_DIRECTA_2 = 'cad-seed-2';
const CAUSA_DIRECTA_3 = 'cad-seed-3';

const PRODUCTO_1 = 'prd-seed-1';
const PRODUCTO_2 = 'prd-seed-2';
const PRODUCTO_3 = 'prd-seed-3';

// ─── Helpers de costos ──────────────────────────────────────────────────────

/** Genera la matriz de costos de un insumo repartida en los períodos 0..n-1. */
function costos(insumo: string, valores: number[]): CostoCvJson[] {
  return valores.map((valor, periodo) => ({ insumo, periodo, valor })).filter((c) => c.valor > 0);
}

function actividad(
  id: string,
  nombre: string,
  items: CostoCvJson[][],
): ActividadCvJson {
  return { id, etapa: 'Inversión', nombre, costos: items.flat() };
}

// ─── Cadena de valor (Alternativa seleccionada) ─────────────────────────────

const productoServicioAsistencia: ProductoCvJson = {
  id: PRODUCTO_1,
  etapa: 'Inversión',
  productoId: '1702006',
  complemento: 'Servicio de asistencia técnica agropecuaria integral',
  descripcion:
    'Servicio de asistencia técnica directa a 480 productores en manejo agronómico, buenas prácticas ' +
    'agrícolas (BPA), manejo integrado de plagas, fertilización basada en análisis de suelos y gestión ' +
    'de la finca como unidad productiva, con visitas prediales y escuelas de campo.',
  unidadMedidaId: 'Productores asistidos',
  cantidad: 480,
  localizacion: { rural: true, ruralDisperso: true, urbano: false },
  poblacion: {
    usarObjetivo: true,
    numero: 480,
    tipoAcumulacion: 'Acumulativo',
    descripcion: 'Pequeños productores agropecuarios inscritos en el registro municipal de productores.',
  },
  actividades: [
    actividad('act-seed-1-1', 'Brindar asistencia técnica predial mediante visitas mensuales a los productores', [
      costos('Mano de obra calificada', [48_000_000, 72_000_000, 72_000_000, 48_000_000]),
      costos('Gastos de viaje', [9_600_000, 14_400_000, 14_400_000, 9_600_000]),
    ]),
    actividad('act-seed-1-2', 'Realizar talleres de capacitación en buenas prácticas agrícolas y gestión empresarial', [
      costos('Mano de obra calificada', [18_000_000, 27_000_000, 27_000_000, 18_000_000]),
      costos('Materiales', [6_000_000, 9_000_000, 9_000_000, 6_000_000]),
    ]),
    actividad('act-seed-1-3', 'Realizar análisis de suelos y diagnóstico productivo de las fincas vinculadas', [
      costos('Servicios tecnológicos', [30_000_000, 30_000_000, 0, 0]),
      costos('Mano de obra no calificada', [6_000_000, 6_000_000, 0, 0]),
    ]),
  ],
  entregables: [],
};

const productoInfraestructura: ProductoCvJson = {
  id: PRODUCTO_2,
  etapa: 'Inversión',
  productoId: '1702007',
  complemento: 'Dotación de maquinaria, equipos e infraestructura de poscosecha',
  descripcion:
    'Centros de acopio y poscosecha dotados con equipos de selección, empaque, secado y pesaje, ' +
    'además de herramientas e insumos de producción entregados a las asociaciones de productores ' +
    'para elevar la calidad, reducir pérdidas y conservar el valor del producto.',
  unidadMedidaId: 'Centros de acopio dotados',
  cantidad: 3,
  localizacion: { rural: true, ruralDisperso: false, urbano: false },
  poblacion: {
    usarObjetivo: false,
    numero: 360,
    tipoAcumulacion: 'No acumulativo',
    descripcion: 'Productores asociados que usarán los centros de acopio.',
  },
  actividades: [
    actividad('act-seed-2-1', 'Adecuar la infraestructura física de los centros de acopio', [
      costos('Materiales', [60_000_000, 30_000_000, 0, 0]),
      costos('Mano de obra no calificada', [24_000_000, 12_000_000, 0, 0]),
      costos('Edificaciones', [90_000_000, 45_000_000, 0, 0]),
    ]),
    actividad('act-seed-2-2', 'Adquirir y entregar maquinaria, equipos y herramientas de poscosecha', [
      costos('Maquinaria y equipo', [120_000_000, 90_000_000, 30_000_000, 0]),
      costos('Imprevistos', [6_000_000, 4_500_000, 1_500_000, 0]),
    ]),
    actividad('act-seed-2-3', 'Realizar el acompañamiento técnico para la puesta en marcha de los centros de acopio', [
      costos('Mano de obra calificada', [0, 18_000_000, 18_000_000, 0]),
      costos('Interventoría', [12_000_000, 12_000_000, 6_000_000, 0]),
    ]),
  ],
  entregables: [],
};

const productoComercializacion: ProductoCvJson = {
  id: PRODUCTO_3,
  etapa: 'Inversión',
  productoId: '1702010',
  complemento: 'Servicio de apoyo a la comercialización agropecuaria',
  descripcion:
    'Servicio de articulación comercial para asociaciones de productores: estudios de mercado, ' +
    'participación en ruedas de negocios y mercados campesinos, certificaciones, marca colectiva y ' +
    'conexión directa con compradores institucionales y canales de distribución regional.',
  unidadMedidaId: 'Asociaciones apoyadas',
  cantidad: 6,
  localizacion: { rural: true, ruralDisperso: false, urbano: true },
  poblacion: {
    usarObjetivo: false,
    numero: 360,
    tipoAcumulacion: 'No acumulativo',
    descripcion: 'Productores pertenecientes a las asociaciones apoyadas.',
  },
  actividades: [
    actividad('act-seed-3-1', 'Elaborar estudios de mercado y planes de negocio para las asociaciones', [
      costos('Mano de obra calificada', [24_000_000, 12_000_000, 0, 0]),
      costos('Servicios tecnológicos', [6_000_000, 3_000_000, 0, 0]),
    ]),
    actividad('act-seed-3-2', 'Organizar ruedas de negocios y mercados campesinos con compradores', [
      costos('Materiales', [0, 15_000_000, 15_000_000, 15_000_000]),
      costos('Gastos de viaje', [0, 9_000_000, 9_000_000, 9_000_000]),
    ]),
    actividad('act-seed-3-3', 'Apoyar la obtención de registros sanitarios, certificaciones y marca colectiva', [
      costos('Servicios tecnológicos', [0, 24_000_000, 24_000_000, 0]),
      costos('Otros', [0, 6_000_000, 6_000_000, 0]),
    ]),
  ],
  entregables: [],
};

// ─── Riesgos ────────────────────────────────────────────────────────────────

const riesgos: RiesgoJson[] = [
  {
    id: 'rsk-seed-1',
    nivelClasificacion: '1',
    tipo: 'Ambientales',
    descripcion: 'Eventos climáticos extremos (sequías, inundaciones, heladas) que afecten los cultivos vinculados.',
    probabilidad: '4',
    impacto: '4',
    efectos: 'Pérdida de cosechas, caída de los ingresos de los productores y rezago en las metas de productividad.',
    medidasMitigacion:
      'Incorporar prácticas de agricultura climáticamente inteligente, calendarios de siembra ajustados al ' +
      'pronóstico del IDEAM, reservorios de agua y promoción de seguros agropecuarios.',
  },
  {
    id: 'rsk-seed-2',
    nivelClasificacion: '2',
    referenciaId: PRODUCTO_2,
    tipo: 'Operacionales',
    descripcion: 'Retrasos en la entrega de maquinaria y equipos por parte de los proveedores.',
    probabilidad: '3',
    impacto: '3',
    efectos: 'Puesta en marcha tardía de los centros de acopio y pérdida de ventanas de cosecha.',
    medidasMitigacion:
      'Cláusulas de cumplimiento y multas en los contratos, cronograma con holguras y seguimiento mensual ' +
      'por parte de la supervisión.',
  },
  {
    id: 'rsk-seed-3',
    nivelClasificacion: '2',
    referenciaId: PRODUCTO_3,
    tipo: 'De mercado',
    descripcion: 'Caída de los precios de venta de los productos agropecuarios o pérdida de compradores.',
    probabilidad: '3',
    impacto: '4',
    efectos: 'Disminución de la rentabilidad y desincentivo a la adopción de las prácticas promovidas.',
    medidasMitigacion:
      'Diversificar canales de comercialización, firmar acuerdos de compra anticipada con compradores ' +
      'institucionales y fortalecer la capacidad de negociación de las asociaciones.',
  },
  {
    id: 'rsk-seed-4',
    nivelClasificacion: '3',
    referenciaId: 'act-seed-1-1',
    tipo: 'Administrativos',
    descripcion: 'Baja asistencia o deserción de los productores en las actividades de capacitación.',
    probabilidad: '3',
    impacto: '2',
    efectos: 'Cobertura inferior a la programada y menor adopción de las prácticas técnicas.',
    medidasMitigacion:
      'Concertar horarios con las asociaciones, realizar las sesiones en las veredas y vincular incentivos ' +
      'no monetarios por asistencia y adopción de prácticas.',
  },
  {
    id: 'rsk-seed-5',
    nivelClasificacion: '1',
    tipo: 'Financieros',
    descripcion: 'Incumplimiento en los desembolsos de recursos de cofinanciación departamental o nacional.',
    probabilidad: '2',
    impacto: '4',
    efectos: 'Interrupción de actividades de la vigencia y reprogramación de metas.',
    medidasMitigacion:
      'Formalizar convenios con vigencias futuras, priorizar recursos en el plan operativo anual de ' +
      'inversiones y reportar oportunamente en los sistemas de seguimiento.',
  },
];

// ─── Indicadores de producto y de resultado ─────────────────────────────────

function indicadorProducto(
  id: string,
  nombre: string,
  metas: Record<number, number>,
  acumulativo: boolean,
  fuente: string,
): IndicadorProductoProgramado {
  return {
    id,
    indicadorId: id,
    nombre,
    esPrincipal: true,
    esAcumulativo: acumulativo,
    fuenteVerificacion: 'Informe',
    detalleFuente: fuente,
    metasPeriodo: metas,
  };
}

const identificacion: IdentificacionData = {
  alternativas: [
    {
      id: ALT_ID,
      nombre:
        'Asistencia técnica integral, dotación de centros de acopio y apoyo a la comercialización asociativa',
      pasaPreparacion: true,
      estado: 'Seleccionada',
    },
    {
      id: 'alt-seed-2',
      nombre: 'Subsidio directo de insumos agropecuarios sin acompañamiento técnico',
      pasaPreparacion: false,
      estado: 'Descartada',
    },
  ],
  evaluaciones: { rentabilidad: false, costoEficiencia: true, multicriterio: false },
  problematica: {
    problemaCentral:
      'Baja productividad y limitada comercialización de los pequeños productores agropecuarios del municipio.',
    efectos: [
      {
        id: EFECTO_DIRECTO_1,
        descripcion: 'Bajos ingresos y rentabilidad de las familias campesinas.',
        tipo: 'directo',
      },
      {
        id: 'efi-seed-1',
        descripcion: 'Aumento de la pobreza rural y de la inseguridad alimentaria en los hogares productores.',
        tipo: 'indirecto',
        parentId: EFECTO_DIRECTO_1,
      },
      {
        id: EFECTO_DIRECTO_2,
        descripcion: 'Abandono de la actividad agropecuaria y migración de jóvenes hacia las cabeceras urbanas.',
        tipo: 'directo',
      },
      {
        id: 'efi-seed-2',
        descripcion: 'Envejecimiento del campo y pérdida de la vocación agropecuaria del territorio.',
        tipo: 'indirecto',
        parentId: EFECTO_DIRECTO_2,
      },
    ],
    causas: [
      {
        id: CAUSA_DIRECTA_1,
        descripcion: 'Deficiente acceso a asistencia técnica y capacitación en prácticas agrícolas adecuadas.',
        tipo: 'directa',
        specificObjective: 'Ampliar la cobertura de asistencia técnica y capacitación a los pequeños productores.',
      },
      {
        id: 'cai-seed-1',
        descripcion: 'Insuficiente presencia de la UMATA y de profesionales del agro en las veredas.',
        tipo: 'indirecta',
        parentId: CAUSA_DIRECTA_1,
      },
      {
        id: CAUSA_DIRECTA_2,
        descripcion: 'Infraestructura y equipos de poscosecha escasos u obsoletos.',
        tipo: 'directa',
        specificObjective: 'Dotar con infraestructura y equipos de poscosecha a las asociaciones de productores.',
      },
      {
        id: 'cai-seed-2',
        descripcion: 'Baja inversión pública y privada en centros de acopio y transformación primaria.',
        tipo: 'indirecta',
        parentId: CAUSA_DIRECTA_2,
      },
      {
        id: CAUSA_DIRECTA_3,
        descripcion: 'Débil articulación comercial y escaso poder de negociación frente a los intermediarios.',
        tipo: 'directa',
        specificObjective: 'Fortalecer los canales de comercialización y la organización asociativa de los productores.',
      },
      {
        id: 'cai-seed-3',
        descripcion: 'Bajos niveles de asociatividad y desconocimiento de los mercados de destino.',
        tipo: 'indirecta',
        parentId: CAUSA_DIRECTA_3,
      },
    ],
    descripcionSituacion:
      'El municipio tiene una vocación predominantemente agropecuaria: cerca del 68 % de la población rural ' +
      'depende de la producción primaria de café, plátano, cacao, frutales y hortalizas. Más del 85 % de las ' +
      'unidades productivas son menores de 5 hectáreas y operan con tecnología tradicional, sin análisis de ' +
      'suelos ni planes de fertilización. La asistencia técnica oficial solo alcanzó al 14 % de los productores ' +
      'en la última vigencia, los productos se venden en finca a intermediarios que fijan el precio, y las ' +
      'pérdidas poscosecha se estiman entre el 18 % y el 25 % por falta de infraestructura de acopio.',
    magnitudIndicadores:
      'Rendimiento promedio de 2,1 t/ha frente a 3,4 t/ha del promedio departamental (-38 %). Ingreso mensual ' +
      'promedio por familia productora de 1,1 SMMLV frente a 1,9 SMMLV de referencia. Cobertura de asistencia ' +
      'técnica: 14 % (67 de 480 productores). Pérdidas poscosecha: 21 %. Asociatividad: 22 % de los productores. ' +
      'Fuente: Evaluaciones Agropecuarias Municipales (EVA), censo de productores municipal y UPRA.',
  },
  poblacion: {
    afectada: {
      tipoPoblacion: 'Personas',
      numero: 1_850,
      fuenteInformacion:
        'Censo Nacional Agropecuario 2014, SISBÉN IV y registro de productores de la UMATA municipal (corte 2025).',
      localizaciones: [
        {
          id: 'loc-seed-1',
          region: 'Región del proyecto (ajustar al clonar)',
          departamento: 'Departamento del proyecto',
          municipio: 'Municipio del proyecto - zona rural',
          tipoAgrupacion: 'Veredas',
          agrupacion: 'Veredas con vocación agropecuaria priorizadas (12)',
          especifica: 'Corregimientos y veredas del área rural dispersa',
          latitud: '4.5339',
          longitud: '-75.6811',
          georeferenciada: true,
        },
      ],
    },
    objetivo: {
      tipoPoblacion: 'Personas',
      numero: 480,
      fuenteInformacion:
        'Registro de productores de la UMATA, priorizados por nivel SISBÉN (A–C), tenencia menor a 5 hectáreas ' +
        'y pertenencia o disposición a asociarse.',
      localizaciones: [
        {
          id: 'loc-seed-2',
          region: 'Región del proyecto (ajustar al clonar)',
          departamento: 'Departamento del proyecto',
          municipio: 'Municipio del proyecto - zona rural',
          tipoAgrupacion: 'Veredas',
          agrupacion: 'Veredas de intervención priorizadas (8)',
          especifica: 'Núcleos productivos con asociaciones activas',
          latitud: '4.5421',
          longitud: '-75.6703',
          georeferenciada: true,
        },
      ],
    },
  },
  objetivos: {
    objetivoGeneral:
      'Incrementar la productividad y los ingresos de los pequeños productores agropecuarios del municipio.',
    indicadores: [
      {
        id: 'ioj-seed-1',
        indicador: 'Rendimiento promedio por hectárea de los cultivos priorizados',
        unidadMedida: 'Toneladas por hectárea',
        meta: 3,
        tipoFuente: 'Informe',
        fuenteVerificacion: 'Evaluaciones Agropecuarias Municipales (EVA) - UMATA',
      },
      {
        id: 'ioj-seed-2',
        indicador: 'Ingreso mensual promedio de las familias productoras beneficiarias',
        unidadMedida: 'Salarios mínimos mensuales',
        meta: 1.7,
        tipoFuente: 'Encuesta',
        fuenteVerificacion: 'Encuesta de línea de salida aplicada a la muestra de beneficiarios',
      },
    ],
    objetivosEspecificos: {
      [CAUSA_DIRECTA_1]: 'Ampliar la cobertura de asistencia técnica y capacitación a los pequeños productores.',
      [CAUSA_DIRECTA_2]: 'Dotar con infraestructura y equipos de poscosecha a las asociaciones de productores.',
      [CAUSA_DIRECTA_3]:
        'Fortalecer los canales de comercialización y la organización asociativa de los productores.',
    },
  },
};

const planDesarrollo: PlanDesarrolloData = {
  pnd: [
    {
      id: 'pnd-seed-1',
      transformacion: 'Transformación productiva, internacionalización y acción climática',
      pilar: 'Transformación productiva y reindustrialización',
      catalizador: 'Reindustrialización en el campo y el territorio',
      componente: 'Productividad y competitividad agropecuaria',
    },
    {
      id: 'pnd-seed-2',
      transformacion: 'Derecho humano a la alimentación',
      pilar: 'Acceso, disponibilidad y estabilidad de alimentos',
      catalizador: 'Fortalecimiento de la agricultura campesina, familiar y comunitaria',
      componente: 'Comercialización y circuitos cortos',
    },
  ],
  departamental: {
    plan: 'Plan de Desarrollo Departamental 2024-2027 - Línea estratégica "Campo productivo y competitivo"',
    estrategia: 'Fortalecimiento de cadenas productivas agropecuarias y de la agricultura familiar',
    programa: 'Asistencia técnica, infraestructura productiva y comercialización rural',
  },
  municipal: {
    plan: 'Plan de Desarrollo Municipal 2024-2027 - Eje "Desarrollo rural sostenible"',
    estrategia: 'Mejoramiento de la productividad y los ingresos de los pequeños productores',
    programa: 'Servicio de asistencia técnica agropecuaria y apoyo a la comercialización',
  },
  etnias: {
    tipoComunidad: 'No aplica',
    instrumentos:
      'Alineado con el Plan Sectorial Agropecuario y el Plan Integral de Desarrollo Agropecuario y Rural con ' +
      'Enfoque Territorial (PIDARET) del departamento; el proyecto no interviene territorios de comunidades étnicas.',
  },
};

const participants: TemplateParticipant[] = [
  {
    id: 'par-seed-1',
    actor_id: 4,
    entity_id: null,
    position_id: 2,
    otro_participante: 'Alcaldía Municipal - Secretaría de Agricultura y UMATA',
    interests:
      'Mejorar los ingresos rurales, cumplir las metas del Plan de Desarrollo y reducir la informalidad del sector.',
    contribution:
      'Formulación, cofinanciación, supervisión técnica y administrativa del proyecto, y uso de la UMATA para la ' +
      'asistencia técnica.',
  },
  {
    id: 'par-seed-2',
    actor_id: 6,
    entity_id: null,
    position_id: 1,
    otro_participante: 'Asociaciones de productores agropecuarios',
    interests:
      'Acceder a asistencia técnica, equipos de poscosecha y canales de venta justos que mejoren la rentabilidad.',
    contribution:
      'Aporte de mano de obra, predios para los centros de acopio, participación activa en los talleres y ' +
      'cumplimiento de los compromisos de operación y mantenimiento.',
  },
  {
    id: 'par-seed-3',
    actor_id: 6,
    entity_id: null,
    position_id: 1,
    otro_participante: 'Comunidad rural de las veredas intervenidas',
    interests:
      'Mejorar las condiciones de vida, generar empleo local y arraigar a los jóvenes en el campo.',
    contribution:
      'Veeduría ciudadana, participación en los espacios de concertación y divulgación de los resultados.',
  },
  {
    id: 'par-seed-4',
    actor_id: 2,
    entity_id: null,
    position_id: 2,
    otro_participante: 'Gobernación - Secretaría de Agricultura Departamental',
    interests: 'Aumentar la producción departamental y consolidar las cadenas productivas priorizadas.',
    contribution: 'Cofinanciación, acompañamiento técnico y articulación con programas departamentales.',
  },
  {
    id: 'par-seed-5',
    actor_id: 6,
    entity_id: null,
    position_id: 3,
    otro_participante: 'Intermediarios y acopiadores tradicionales',
    interests: 'Mantener su margen de intermediación en la compra directa en finca.',
    contribution: 'Ninguno; se mitiga con la vinculación voluntaria a los nuevos canales de comercialización.',
  },
];

const preparacion: PreparacionData = {
  necesidades: {
    [ALT_ID]: [
      {
        id: 'nec-seed-1',
        bienServicio: 'Servicio de asistencia técnica agropecuaria',
        descripcion:
          'Servicio de acompañamiento técnico predial que requieren los pequeños productores para adoptar buenas ' +
          'prácticas agrícolas y mejorar el rendimiento de sus cultivos.',
        descripcionOferta:
          'Productores atendidos actualmente por la UMATA con visitas y capacitaciones anuales.',
        descripcionDemanda:
          'Productores registrados con unidades productivas menores a 5 hectáreas que requieren asistencia técnica.',
        unidadMedidaId: 'Productores',
        anoInicial: 2022,
        anoFinal: 2030,
        ultimoAnoProyectado: 2030,
        historico: [
          { ano: 2022, oferta: 52, demanda: 470, deficit: -418 },
          { ano: 2023, oferta: 58, demanda: 474, deficit: -416 },
          { ano: 2024, oferta: 63, demanda: 478, deficit: -415 },
          { ano: 2025, oferta: 67, demanda: 480, deficit: -413 },
          { ano: 2026, oferta: 547, demanda: 482, deficit: 65 },
        ],
      },
    ],
  },
  analisisTecnico: {
    [ALT_ID]: {
      resumen:
        'La alternativa combina asistencia técnica integral con dotación de centros de acopio y apoyo comercial. ' +
        'Es técnicamente viable: utiliza el equipo profesional de la UMATA reforzado con contratistas, aprovecha ' +
        'predios aportados por las asociaciones, emplea tecnología probada de bajo costo y cumple con la normativa ' +
        'ICA, INVIMA y ambiental aplicable. El plazo de ejecución es de cuatro vigencias, con operación y ' +
        'mantenimiento a cargo de las asociaciones y de la Alcaldía.',
    },
  },
  cadenaValorPrep: {
    [ALT_ID]: {
      objetivos: {
        [CAUSA_DIRECTA_1]: { productos: [productoServicioAsistencia] },
        [CAUSA_DIRECTA_2]: { productos: [productoInfraestructura] },
        [CAUSA_DIRECTA_3]: { productos: [productoComercializacion] },
      },
    },
  },
  riesgos: { [ALT_ID]: riesgos },
  ingresosBeneficios: {
    [ALT_ID]: [
      {
        id: 'ing-seed-1',
        tipo: 'Beneficios',
        descripcion: 'Incremento de ingresos por mayor productividad y reducción de pérdidas poscosecha.',
        descripcionCantidad: 'Toneladas adicionales comercializadas por año por los productores beneficiarios.',
        unidadMedidaId: 'Toneladas',
        descripcionValorUnitario: 'Precio promedio de venta ponderado de los productos priorizados.',
        bienProducidoId: PRODUCTO_1,
        rpc: 0.8,
        proyecciones: [
          { periodo: 1, cantidad: 180, valorUnitario: 2_400_000, valorTotal: 432_000_000 },
          { periodo: 2, cantidad: 300, valorUnitario: 2_400_000, valorTotal: 720_000_000 },
          { periodo: 3, cantidad: 420, valorUnitario: 2_400_000, valorTotal: 1_008_000_000 },
        ],
      },
    ],
  },
  prestamos: {},
  depreciacion: {},
};

const programacion: ProgramacionData = {
  indicadoresProducto: {
    [PRODUCTO_1]: [
      indicadorProducto(
        'ipr-seed-1',
        'Productores atendidos con asistencia técnica agropecuaria',
        { 0: 120, 1: 120, 2: 120, 3: 120 },
        true,
        'Registros de visitas prediales y listados de asistencia de la UMATA.',
      ),
    ],
    [PRODUCTO_2]: [
      indicadorProducto(
        'ipr-seed-2',
        'Centros de acopio y poscosecha dotados',
        { 0: 1, 1: 1, 2: 1, 3: 0 },
        true,
        'Actas de entrega y recibo a satisfacción de la dotación.',
      ),
    ],
    [PRODUCTO_3]: [
      indicadorProducto(
        'ipr-seed-3',
        'Asociaciones de productores apoyadas en comercialización',
        { 0: 2, 1: 2, 2: 2, 3: 0 },
        true,
        'Informes de supervisión y convenios comerciales suscritos.',
      ),
    ],
  },
  focalizacion: {
    politicasPoblacionales: {
      afectada: [
        {
          categoriaId: 'pol-1',
          categoriaNombre: 'Víctimas del conflicto armado',
          subcategoriaId: 'sub-1-1',
          subcategoriaNombre: 'Desplazados',
        },
        {
          categoriaId: 'pol-5',
          categoriaNombre: 'Otras Políticas',
          subcategoriaId: 'sub-5-2',
          subcategoriaNombre: 'Cultura',
        },
      ],
    },
    politicasConPoblacion: {
      'Víctimas del conflicto armado': {
        categoria: 'Categoría B - Atención Integral',
        indicador: 'Proporción de población atendida',
      },
      'Equidad de género (mujer rural)': {
        categoria: 'Categoría C - Inclusión',
        indicador: 'Número de proyectos apoyados',
      },
      Juventud: {
        categoria: 'Categoría C - Inclusión',
        indicador: 'Tasa de cobertura efectiva',
      },
    },
    politicasSinPoblacion: [],
    crucesPoliticas: {
      'Víctimas del conflicto armado': ['Reforma Rural Integral', 'Sustitución voluntaria de cultivos'],
      'Equidad de género (mujer rural)': ['Política pública de mujer rural', 'Equidad de género para las mujeres'],
      Juventud: ['Política Nacional de Juventud', 'Arraigo de jóvenes rurales'],
    },
  },
};

/**
 * Plantilla semilla por defecto: proyecto MGA formulado de punta a punta (problemática, objetivos, población,
 * participantes, alineación PND, alternativas, cadena de valor con costos, riesgos, indicadores y focalización).
 */
export const MGA_SEED_TEMPLATE: ProjectTemplate = {
  id: MGA_SEED_TEMPLATE_ID,
  name: 'Fortalecimiento de la productividad y comercialización agropecuaria en pequeños productores',
  description:
    'Plantilla MGA completa de referencia: asistencia técnica, dotación de centros de acopio y apoyo a la ' +
    'comercialización asociativa para pequeños productores rurales. Incluye árbol de problemas, objetivos con ' +
    'verbo fuerte, cadena de valor con costos por insumo, riesgos, indicadores y focalización de políticas.',
  sector: 'Agricultura y desarrollo rural',
  isSystem: true,
  objeto:
    'Fortalecimiento de la productividad y la comercialización agropecuaria de los pequeños productores rurales',
  problem_description:
    'Baja productividad y limitada comercialización de los pequeños productores agropecuarios del municipio.',
  general_objective:
    'Incrementar la productividad y los ingresos de los pequeños productores agropecuarios del municipio.',
  situacion_existente: identificacion.problematica?.descripcionSituacion ?? '',
  magnitud_problema: identificacion.problematica?.magnitudIndicadores ?? '',
  formulation: {
    identificacion,
    planDesarrollo,
    participants,
    preparacion,
    programacion,
    evaluacion: { alternativaSeleccionadaId: ALT_ID },
  },
  createdAt: '2026-01-01T00:00:00.000Z',
};
