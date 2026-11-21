export type BankKind = "income" | "expense" | "capital";
export type ParsedBankRow = { booked_date: string; text: string; amount: number; balance: number | null; dedupe_key: string };
export type BankRule = { pattern: string; kind: BankKind; category: string };

const num = (s: string) => {
  const t = s.replace(/\./g, "").replace(",", ".").trim();
  return t === "" ? null : Number(t);
};

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === ";" && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** Parses Danish bank CSV: "Dato";"Valør";"Tekst";"";"Beløb";"Saldo";... */
export function parseBankCsv(csv: string): ParsedBankRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const rows: ParsedBankRow[] = [];
  for (const line of lines.slice(1)) {
    const c = splitLine(line);
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((c[0] ?? "").trim());
    const amount = num(c[4] ?? "");
    if (!m || amount === null || Number.isNaN(amount)) continue;
    const booked_date = `${m[3]}-${m[2]}-${m[1]}`;
    const text = (c[2] ?? "").trim();
    const balance = num(c[5] ?? "");
    rows.push({ booked_date, text, amount, balance, dedupe_key: `${booked_date}|${text}|${amount}|${balance ?? ""}` });
  }
  return rows;
}

/** Normalised pattern for learning: lowercase, digits and punctuation removed. */
export function bankPattern(text: string): string {
  return text.toLowerCase().replace(/[0-9]/g, "").replace(/[^a-zæøå ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function matchRule(text: string, rules: BankRule[]): BankRule | null {
  const p = bankPattern(text);
  const hits = rules.filter((r) => r.pattern && p.includes(r.pattern));
  hits.sort((a, b) => b.pattern.length - a.pattern.length);
  return hits[0] ?? null;
}
