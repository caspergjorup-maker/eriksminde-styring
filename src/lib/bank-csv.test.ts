/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { matchRule, parseBankCsv, bankPattern } from "./bank-csv";

const csv = `"Dato";"Valør";"Tekst";"";"Beløb";"Saldo";"Egen bilagsreference"
"09.11.2026";"09.11.2026";"Skive Vand";"";"-2.997,15";"32.452,85";""
"20.10.2026";"20.10.2026";"Fra 7263-0001062279 - Privat indbet -SE MEDD.";"";"100.000,00";"99.850,00";""`;

describe("bank csv", () => {
  it("parses Danish amounts and dates", () => {
    const r = parseBankCsv(csv);
    expect(r[0]).toMatchObject({ booked_date: "2026-11-09", amount: -2997.15, balance: 32452.85 });
    expect(r[1]?.amount).toBe(100000);
  });
  it("known text is categorised, unknown is not", () => {
    const rules = [{ pattern: bankPattern("Skive Vand"), kind: "expense" as const, category: "energi" }];
    expect(matchRule("Skive Vand", rules)?.category).toBe("energi");
    expect(matchRule("Ukendt firma", rules)).toBeNull();
  });
});
