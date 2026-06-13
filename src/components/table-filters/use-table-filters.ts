import { useMemo, useState } from "react";
import type { FilterColumn, FiltersState, SortState } from "./types";

export type UseTableFiltersOptions<T> = {
  rows: T[];
  columns: FilterColumn<T>[];
  /** Functions extracting strings searched by the free-text input. */
  searchFields?: ((row: T) => string | null | undefined)[];
  initialSort?: SortState;
};

export function useTableFilters<T>({
  rows,
  columns,
  searchFields = [],
  initialSort = null,
}: UseTableFiltersOptions<T>) {
  const [search, setSearch] = useState("");
  const [enums, setEnums] = useState<Record<string, string[]>>({});
  const [ranges, setRanges] = useState<Record<string, { min: string; max: string }>>({});
  const [sort, setSort] = useState<SortState>(initialSort);

  const enumColumns = useMemo(
    () => columns.filter((c) => c.type === "enum"),
    [columns],
  );
  const numberColumns = useMemo(
    () => columns.filter((c) => c.type === "number"),
    [columns],
  );

  /** Derived options per enum column from data, when not supplied. */
  const enumOptions = useMemo(() => {
    const map: Record<string, { value: string; label: string }[]> = {};
    for (const col of enumColumns) {
      if (col.options) {
        map[col.key] = col.options;
        continue;
      }
      const set = new Set<string>();
      for (const r of rows) {
        const v = col.get?.(r);
        if (v != null && v !== "") set.add(String(v));
      }
      map[col.key] = [...set].sort().map((v) => ({ value: v, label: v }));
    }
    return map;
  }, [enumColumns, rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle && searchFields.length) {
        const haystack = searchFields
          .map((f) => f(row))
          .filter((x): x is string => !!x)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      for (const col of enumColumns) {
        const active = enums[col.key];
        if (!active || active.length === 0) continue;
        const v = col.get?.(row);
        const sv = v == null || v === "" ? "" : String(v);
        if (!active.includes(sv)) return false;
      }
      for (const col of numberColumns) {
        const r = ranges[col.key];
        if (!r) continue;
        const v = col.get?.(row);
        const num = typeof v === "number" ? v : v == null || v === "" ? null : Number(v);
        const min = r.min.trim() === "" ? null : Number(r.min);
        const max = r.max.trim() === "" ? null : Number(r.max);
        if (min != null && (num == null || num < min)) return false;
        if (max != null && (num == null || num > max)) return false;
      }
      return true;
    });
  }, [rows, search, searchFields, enumColumns, enums, numberColumns, ranges]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const getV = col.sortValue ?? col.get;
    if (!getV) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = getV(a);
      const bv = getV(b);
      const aNull = av == null || av === "";
      const bNull = bv == null || bv === "";
      if (aNull && bNull) return 0;
      if (aNull) return 1; // nulls last
      if (bNull) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "da") * dir;
    });
  }, [filtered, sort, columns]);

  const activeCount =
    (search.trim() ? 1 : 0) +
    Object.values(enums).filter((a) => a && a.length > 0).length +
    Object.values(ranges).filter((r) => r && (r.min.trim() !== "" || r.max.trim() !== "")).length;

  function clear() {
    setSearch("");
    setEnums({});
    setRanges({});
  }

  function toggleEnum(key: string, value: string) {
    setEnums((prev) => {
      const cur = prev[key] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...prev, [key]: next };
    });
  }

  function setRange(key: string, side: "min" | "max", value: string) {
    setRanges((prev) => ({
      ...prev,
      [key]: { min: prev[key]?.min ?? "", max: prev[key]?.max ?? "", [side]: value },
    }));
  }

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  const state: FiltersState = { search, enums, ranges, sort };

  return {
    rows: sorted,
    state,
    enumColumns,
    numberColumns,
    enumOptions,
    activeCount,
    setSearch,
    toggleEnum,
    setRange,
    sort,
    toggleSort,
    clear,
  };
}

export type TableFiltersApi<T> = ReturnType<typeof useTableFilters<T>>;
