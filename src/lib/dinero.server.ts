// Server-only Dinero API helper (personal integration: client credentials + API key).
const AUTH_URL = "https://authz.dinero.dk/dineroapi/oauth/token";
const API = "https://api.dinero.dk/v1";

let cached: { token: string; exp: number; orgId: number; orgName: string } | null = null;

function creds() {
  const id = process.env.DINERO_CLIENT_ID;
  const secret = process.env.DINERO_CLIENT_SECRET;
  const key = process.env.DINERO_API_KEY;
  if (!id || !secret || !key) throw new Error("Dinero er ikke sat op (mangler nøgler).");
  return { id, secret, key };
}

async function session() {
  if (cached && cached.exp > Date.now() + 60_000) return cached;
  const { id, secret, key } = creds();
  const body = new URLSearchParams({ grant_type: "password", scope: "read write", username: key, password: key });
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    console.error(`Dinero auth failed [${res.status}]: ${await res.text()}`);
    throw new Error(`Dinero afviste login (${res.status}). Tjek nøglerne.`);
  }
  const tok = (await res.json()) as { access_token: string; expires_in: number };
  const orgRes = await fetch(`${API}/organizations?fields=Name,Id`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  if (!orgRes.ok) throw new Error(`Kunne ikke hente Dinero-firma (${orgRes.status}).`);
  const orgs = (await orgRes.json()) as { Id: number; Name: string }[];
  if (!orgs[0]) throw new Error("API-nøglen giver ikke adgang til noget Dinero-firma.");
  cached = { token: tok.access_token, exp: Date.now() + tok.expires_in * 1000, orgId: orgs[0].Id, orgName: orgs[0].Name };
  return cached;
}

export async function dineroOrg() {
  const s = await session();
  return { id: s.orgId, name: s.orgName };
}

export async function dinero<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const s = await session();
  const res = await fetch(`${API}/${s.orgId}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Dinero ${path} failed [${res.status}]: ${text.slice(0, 1000)}`);
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      msg = j.languageSpecificMessages?.[0]?.message ?? j.message ?? msg;
    } catch { /* html */ }
    throw new Error(`Dinero-fejl (${res.status}): ${msg}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export type DineroEntry = { AccountNumber: number; AccountName: string; Date: string; Description: string; Amount: number };
export type DineroYear = { Name: string; FromDate: string; ToDate: string };

/** Splits a calendar year's entries into monthly P&L figures (accounts < 50000). Income positive, expenses positive. */
export function summarizeEntries(entries: DineroEntry[], depositAccounts: number[]) {
  const income = Array(12).fill(0) as number[];
  const expense = Array(12).fill(0) as number[];
  let bank = 0;
  for (const e of entries) {
    const m = Number(e.Date.slice(5, 7)) - 1;
    if (depositAccounts.includes(e.AccountNumber)) bank += e.Amount;
    if (e.AccountNumber >= 50000 || m < 0 || m > 11) continue;
    if (e.Amount < 0) income[m] += -e.Amount;
    else expense[m] += e.Amount;
  }
  return { income, expense, bank };
}
