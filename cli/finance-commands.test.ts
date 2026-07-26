import { describe, expect, it } from "vitest";
import { parseMoneyToCents, parseSignedMoneyToCents } from "./finance-commands.js";

describe("finance command amount parsing", () => {
  it("converts major currency units to integer cents", () => {
    expect(parseMoneyToCents("400")).toBe(40_000);
    expect(parseMoneyToCents("12.3")).toBe(1_230);
    expect(parseMoneyToCents("0.09")).toBe(9);
  });

  it("rejects negative, over-precise, and malformed amounts", () => {
    expect(() => parseMoneyToCents("-1")).toThrow("finance_amount_invalid");
    expect(() => parseMoneyToCents("1.001")).toThrow("finance_amount_invalid");
    expect(() => parseMoneyToCents("$5")).toThrow("finance_amount_invalid");
  });
});

describe("finance balance parsing", () => {
  it("accepts signed company balances", () => {
    expect(parseSignedMoneyToCents("400")).toBe(40_000);
    expect(parseSignedMoneyToCents("-400")).toBe(-40_000);
    expect(parseSignedMoneyToCents("-0.09")).toBe(-9);
  });

  it("rejects malformed or over-precise balances", () => {
    expect(() => parseSignedMoneyToCents("1.001")).toThrow("finance_amount_invalid");
    expect(() => parseSignedMoneyToCents("$5")).toThrow("finance_amount_invalid");
  });
});
