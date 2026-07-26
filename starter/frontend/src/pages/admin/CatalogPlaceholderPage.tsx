type CatalogPlaceholderPageProps = {
  title: string;
  description?: string;
};

export default function CatalogPlaceholderPage({
  title,
  description = 'Esta sección del catálogo maestro aún no está disponible.',
}: CatalogPlaceholderPageProps) {
  return (
    <div className="-m-6 font-body text-[#121c2c]">
      <div className="p-6 md:p-12 max-w-[1280px] mx-auto">
        <h3 className="font-headline text-2xl font-semibold text-[#121c2c] mb-1">{title}</h3>
        <p className="text-base text-[#3f4949] mb-10">{description}</p>
        <div className="glass-card bg-white/95 rounded-xl border border-[#E2E8F0] p-12 text-center shadow-sm">
          <span className="material-symbols-outlined text-5xl text-[#006162] mb-3 block">
            construction
          </span>
          <p className="font-semibold text-lg">Próximamente</p>
          <p className="text-sm mt-1 text-[#3f4949]">{description}</p>
        </div>
      </div>
    </div>
  );
}
