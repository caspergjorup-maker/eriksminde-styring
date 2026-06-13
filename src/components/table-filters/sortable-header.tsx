import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortState } from "./types";

type Props = {
  label: string;
  sortKey: string;
  sort: SortState;
  onToggle: (key: string) => void;
  align?: "left" | "right";
  className?: string;
};

export function SortableHeader({ label, sortKey, sort, onToggle, align = "left", className }: Props) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort?.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={`px-3 py-2 font-medium select-none cursor-pointer ${align === "right" ? "text-right" : "text-left"} ${className ?? ""}`}
      onClick={() => onToggle(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {label}
        <Icon className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/50"}`} />
      </span>
    </th>
  );
}
