import { useRef, useState } from "react";

import {
  MatrikelMap,
  type FieldSummary,
  type MatrikelMapHandle,
  USE_TYPE_COLORS,
  USE_TYPE_LABELS,
} from "@/components/matrikel-map";
import { formatDKK, formatDate } from "@/lib/format";


export function MarkerPage() {
  const mapRef = useRef<MatrikelMapHandle>(null);
  const [fields, setFields] = useState<FieldSummary[]>([]);

  const handleRowClick = (id: string) => {
    mapRef.current?.highlightField(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-lg font-medium mb-1">Marker</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Skift mellem mark- og matrikelvisning. Klik på en mark for at se areal, forpagter og
        kontraktoplysninger.
      </p>

      <MatrikelMap ref={mapRef} onFieldsReady={setFields} />

      <div className="mt-6 rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Mark</th>
              <th className="text-left px-3 py-2 font-medium">Matrikler</th>
              <th className="text-left px-3 py-2 font-medium">Samlet ha</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-left px-3 py-2 font-medium">Forpagter</th>
              <th className="text-left px-3 py-2 font-medium">Årlig leje</th>
              <th className="text-left px-3 py-2 font-medium">Kontraktudløb</th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-xs">
                  Indlæser marker…
                </td>
              </tr>
            )}
            {fields.map((f) => (
              <tr
                key={f.id}
                onClick={() => handleRowClick(f.id)}
                className="border-t border-border cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <td className="px-3 py-2 font-medium">{f.name}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{f.matrikler.join(", ")}</td>
                <td className="px-3 py-2">{f.totalHa} ha</td>
                <td className="px-3 py-2">
                  {f.use_type ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] text-white"
                      style={{ background: USE_TYPE_COLORS[f.use_type] }}
                    >
                      {USE_TYPE_LABELS[f.use_type]}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">{f.leaseholder ?? "—"}</td>
                <td className="px-3 py-2">{f.annualFee != null ? formatDKK(f.annualFee) : "—"}</td>
                <td className="px-3 py-2">{formatDate(f.contractEnd) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
