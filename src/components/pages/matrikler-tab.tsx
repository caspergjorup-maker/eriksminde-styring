import { useMatrikelData, USE_TYPE_COLORS, USE_TYPE_LABELS, type MatrikelRow } from "@/lib/use-matrikel";
import {
  TableToolbar,
  SortableHeader,
  useTableFilters,
  type FilterColumn,
} from "@/components/table-filters";

const COLUMNS: FilterColumn<MatrikelRow>[] = [
  { key: "matrikelnr", label: "Matrikel", sortable: true, sortValue: (m) => m.matrikelnr },
  { key: "ejerlav", label: "Ejerlav", type: "enum", get: (m) => m.ejerlav, sortable: true, sortValue: (m) => m.ejerlav },
  {
    key: "use_type",
    label: "Type",
    type: "enum",
    get: (m) => m.use_type ?? "",
    options: [
      { value: "omdrift", label: "Omdrift" },
      { value: "skov", label: "Skov" },
      { value: "gaard", label: "Gårdsareal" },
      { value: "", label: "(ingen)" },
    ],
    sortable: true,
    sortValue: (m) => m.use_type ?? "",
  },
  {
    key: "field",
    label: "Mark",
    type: "enum",
    get: (m) => (m.fieldNames.length ? m.fieldNames[0] : ""),
    sortable: true,
    sortValue: (m) => m.fieldNames.join(", "),
  },
  {
    key: "registreret",
    label: "Registreret areal (ha)",
    type: "number",
    get: (m) => m.registreretAreaHa,
    sortable: true,
    sortValue: (m) => m.registreretAreaHa,
  },
  {
    key: "net",
    label: "Nettoareal (ha)",
    type: "number",
    get: (m) => m.netAreaHa,
    sortable: true,
    sortValue: (m) => m.netAreaHa,
  },
];

export function MatriklerPage() {
  const { data, isLoading, error } = useMatrikelData();
  const allMatrikler = data?.matrikler ?? [];

  const filters = useTableFilters({
    rows: allMatrikler,
    columns: COLUMNS,
    searchFields: [
      (m) => m.matrikelnr,
      (m) => m.ejerlav,
      (m) => m.fieldNames.join(" "),
    ],
  });
  const matrikler = filters.rows;

  const totalRegistreret = matrikler.reduce((s, m) => s + (m.registreretAreaHa ?? 0), 0);
  const totalNet = matrikler.reduce((s, m) => s + (m.netAreaHa ?? 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-lg font-medium mb-1">Matrikler</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Oversigt over matrikler fra Datafordeler med tilknyttede marker.
      </p>

      <TableToolbar api={filters} searchPlaceholder="Søg matrikel, ejerlav, mark…" />

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortableHeader label="Matrikel" sortKey="matrikelnr" sort={filters.sort} onToggle={filters.toggleSort} />
              <SortableHeader label="Ejerlav" sortKey="ejerlav" sort={filters.sort} onToggle={filters.toggleSort} />
              <SortableHeader label="Type" sortKey="use_type" sort={filters.sort} onToggle={filters.toggleSort} />
              <SortableHeader label="Mark" sortKey="field" sort={filters.sort} onToggle={filters.toggleSort} />
              <SortableHeader label="Registreret areal" sortKey="registreret" sort={filters.sort} onToggle={filters.toggleSort} align="right" />
              <SortableHeader label="Nettoareal" sortKey="net" sort={filters.sort} onToggle={filters.toggleSort} align="right" />
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
                  {allMatrikler.length === 0 ? "Ingen matrikler fundet." : "Ingen matrikler matcher filtrene."}
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
                <td className="px-3 py-2" colSpan={4}>I alt ({matrikler.length}{matrikler.length !== allMatrikler.length ? ` af ${allMatrikler.length}` : ""})</td>
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
