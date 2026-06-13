import { useMatrikelData, USE_TYPE_COLORS, USE_TYPE_LABELS } from "@/lib/use-matrikel";

export function MatriklerPage() {
  const { data, isLoading, error } = useMatrikelData();
  const matrikler = data?.matrikler ?? [];

  const totalRegistreret = matrikler.reduce((s, m) => s + (m.registreretAreaHa ?? 0), 0);
  const totalNet = matrikler.reduce((s, m) => s + (m.netAreaHa ?? 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-lg font-medium mb-1">Matrikler</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Oversigt over matrikler fra Datafordeler med tilknyttede marker.
      </p>

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Matrikel</th>
              <th className="text-left px-3 py-2 font-medium">Ejerlav</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-left px-3 py-2 font-medium">Mark</th>
              <th className="text-right px-3 py-2 font-medium">Registreret areal</th>
              <th className="text-right px-3 py-2 font-medium">Nettoareal</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  Indlæser matrikler…
                </td>
              </tr>
            )}
            {error && !isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-destructive text-xs">
                  Kunne ikke hente matrikler.
                </td>
              </tr>
            )}
            {!isLoading && !error && matrikler.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  Ingen matrikler fundet.
                </td>
              </tr>
            )}
            {matrikler.map((m) => (
              <tr key={m.parcelId} className="border-t border-border hover:bg-muted/40 transition-colors">
                <td className="px-3 py-2 font-medium">Matr. {m.matrikelnr}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{m.ejerlav}</td>
                <td className="px-3 py-2">
                  {m.use_type ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] text-white"
                      style={{ background: USE_TYPE_COLORS[m.use_type] }}
                    >
                      {USE_TYPE_LABELS[m.use_type]}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{m.fieldNames.length > 0 ? m.fieldNames.join(", ") : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {m.registreretAreaHa != null ? `${m.registreretAreaHa} ha` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {m.netAreaHa != null ? `${m.netAreaHa} ha` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          {matrikler.length > 0 && (
          <tfoot>
              <tr className="border-t border-border bg-muted/30 font-medium">
                <td className="px-3 py-2" colSpan={4}>I alt ({matrikler.length})</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalRegistreret.toFixed(2)} ha</td>
                <td className="px-3 py-2 text-right tabular-nums">{totalNet.toFixed(2)} ha</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
