type Feature = {
  icon: string;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    icon: 'upload_file',
    title: 'Carga y análisis MGA/XML',
    description:
      'Importa documentos MGA y estructuras XML para extraer automáticamente problemas, objetivos, productos y entregables alineados al marco DNP.',
  },
  {
    icon: 'psychology',
    title: 'Asistente RAG con IA',
    description:
      'Consulta en lenguaje natural el conocimiento indexado del DNP. Aurora responde con contexto metodológico y sugerencias accionables.',
  },
  {
    icon: 'monitoring',
    title: 'Dashboard de control',
    description:
      'Visualiza presupuestos, indicadores y evaluaciones financieras (VPN/TIR) en un panel interactivo para decisiones informadas.',
  },
  {
    icon: 'shield_person',
    title: 'Roles y seguridad',
    description:
      'Gestión multi-tenant con RBAC: Super Admin, formuladores, evaluadores y analistas con acceso granular y trazabilidad.',
  },
];

function FeatureCard({ icon, title, description }: Feature) {
  return (
    <article className="group rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-[#006162] transition group-hover:bg-[#006162] group-hover:text-white">
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>
    </article>
  );
}

export default function LandingFeatures() {
  return (
    <section id="caracteristicas" className="bg-gray-50/80 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Todo lo que necesitas para formulación MGA
          </h2>
          <p className="mt-4 text-base text-gray-600 sm:text-lg">
            Herramientas integradas para acelerar el ciclo de inversión pública con calidad
            metodológica.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
