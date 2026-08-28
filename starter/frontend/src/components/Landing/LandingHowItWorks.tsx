const STEPS = [
  {
    step: 1,
    icon: 'cloud_upload',
    title: 'Sube tu documento MGA',
    description:
      'Carga el archivo XML o completa la formulación en la plataforma. Aurora valida la estructura y prepara los datos.',
  },
  {
    step: 2,
    icon: 'hub',
    title: 'La IA procesa la información',
    description:
      'El motor indexa el conocimiento, genera embeddings y construye el grafo metodológico para consultas RAG.',
  },
  {
    step: 3,
    icon: 'analytics',
    title: 'Analiza y genera reportes',
    description:
      'Explora indicadores, consulta al asistente, evalúa VPN/TIR y exporta reportes para tu equipo técnico.',
  },
] as const;

export default function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Cómo funciona
          </h2>
          <p className="mt-4 text-base text-gray-600 sm:text-lg">
            Tres pasos para pasar del documento MGA a decisiones basadas en datos.
          </p>
        </div>

        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <div
            className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-10 hidden h-0.5 bg-gradient-to-r from-teal-200 via-[#006162]/30 to-teal-200 md:block"
            aria-hidden
          />

          {STEPS.map(({ step, icon, title, description }) => (
            <li key={step} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#006162]/20 bg-white shadow-md">
                <span className="material-symbols-outlined text-3xl text-[#006162]">{icon}</span>
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#006162] text-xs font-bold text-white">
                  {step}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-600">{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
