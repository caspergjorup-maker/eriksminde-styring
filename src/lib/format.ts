const dkkFormatter = new Intl.NumberFormat("da-DK", {
  style: "decimal",
  maximumFractionDigits: 0,
});

export function formatDKK(amount: number | null | undefined): string {
  if (amount == null || isNaN(Number(amount))) return "0 kr";
  return `${dkkFormatter.format(Math.round(Number(amount)))} kr`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "0";
  return new Intl.NumberFormat("da-DK").format(Number(n));
}

const dateFormatter = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "—";
  return dateFormatter.format(d);
}

export function daysUntil(input: string | Date | null | undefined): number | null {
  if (!input) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
