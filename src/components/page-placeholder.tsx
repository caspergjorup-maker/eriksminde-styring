export function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-[var(--brand-900)]">{title}</h1>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
      <div className="mt-8 bg-card border border-dashed border-border rounded-xl p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Denne sektion bygges i næste fase. Database og relationer er på plads — listevisning,
          formularer og redigering kommer i fase 2.
        </p>
      </div>
    </div>
  );
}
