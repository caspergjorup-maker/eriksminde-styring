import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TableFiltersApi } from "./use-table-filters";

type Props<T> = {
  api: TableFiltersApi<T>;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Hide the search input (when no searchFields configured). */
  showSearch?: boolean;
  className?: string;
};

export function TableToolbar<T>({
  api,
  searchPlaceholder = "Søg…",
  showSearch = true,
  className,
}: Props<T>) {
  const { state, setSearch, enumColumns, numberColumns, enumOptions, toggleEnum, setRange, clear, activeCount } = api;
  const hasFilterUi = enumColumns.length > 0 || numberColumns.length > 0;

  return (
    <div className={`flex items-center gap-2 mb-3 ${className ?? ""}`}>
      {showSearch && (
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={state.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-7 text-sm"
          />
        </div>
      )}

      {hasFilterUi && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtre
              {activeCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 space-y-4" align="end">
            {enumColumns.map((col) => {
              const opts = enumOptions[col.key] ?? [];
              const active = state.enums[col.key] ?? [];
              return (
                <div key={col.key} className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">{col.label}</div>
                  {opts.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">Ingen værdier</div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {opts.map((o) => {
                        const id = `f-${col.key}-${o.value}`;
                        return (
                          <div key={o.value} className="flex items-center gap-2">
                            <Checkbox
                              id={id}
                              checked={active.includes(o.value)}
                              onCheckedChange={() => toggleEnum(col.key, o.value)}
                            />
                            <Label htmlFor={id} className="text-xs font-normal cursor-pointer">
                              {o.label}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {numberColumns.map((col) => {
              const r = state.ranges[col.key] ?? { min: "", max: "" };
              return (
                <div key={col.key} className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">{col.label}</div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={r.min}
                      onChange={(e) => setRange(col.key, "min", e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={r.max}
                      onChange={(e) => setRange(col.key, "max", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end pt-1 border-t border-border">
              <Button variant="ghost" size="sm" onClick={clear} className="h-7 text-xs gap-1">
                <X className="h-3 w-3" /> Ryd
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {activeCount > 0 && !hasFilterUi && (
        <Button variant="ghost" size="sm" onClick={clear} className="h-8 text-xs gap-1">
          <X className="h-3 w-3" /> Ryd
        </Button>
      )}
    </div>
  );
}
