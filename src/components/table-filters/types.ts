export type ColumnType = "enum" | "number" | "text";

export type FilterColumn<T> = {
  /** Stable key, used in state */
  key: string;
  /** Header label shown in the filter UI */
  label: string;
  /** Filter UI to render. If omitted no filter UI is shown for this column. */
  type?: ColumnType;
  /** Value extractor used for filtering (enum match / text contains / range) */
  get?: (row: T) => string | number | null | undefined;
  /** Predefined options for enum filters. If omitted, derived from data. */
  options?: { value: string; label: string }[];
  /** Value extractor used for sorting. Defaults to `get`. */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Whether this column can be sorted (header click). */
  sortable?: boolean;
};

export type SortState = { key: string; dir: "asc" | "desc" } | null;

export type FiltersState = {
  search: string;
  enums: Record<string, string[]>;
  ranges: Record<string, { min: string; max: string }>;
  sort: SortState;
};
