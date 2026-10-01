import { describe, expect, it } from "vitest";
import { normalizeReading } from "./model";

const reading = {
  project: " globex ",
  metric: "cash",
  value: 1234.5,
  display: " $1.2k ",
  unit: "USD",
  at: 1_700_000_000_000.7,
  source: "bank",
};

describe("metric readings", () => {
  it("trims ids and text and floors the time", () => {
    expect(normalizeReading(reading)).toEqual({
      project: "globex",
      metric: "cash",
      value: 1234.5,
      display: "$1.2k",
      unit: "USD",
      at: 1_700_000_000_000,
      source: "bank",
      note: undefined,
    });
  });

  it("allows a null value and defaults the display to the number", () => {
    expect(normalizeReading({ ...reading, value: null, display: "n/a" }).value).toBeNull();
    expect(normalizeReading({ ...reading, value: 42, display: " " }).display).toBe("42");
  });

  it("refuses readings no screen could show", () => {
    expect(() => normalizeReading({ ...reading, project: "../etc" })).toThrow(/project/);
    expect(() => normalizeReading({ ...reading, metric: "" })).toThrow(/metric/);
    expect(() => normalizeReading({ ...reading, value: Number.NaN })).toThrow(/finite/);
    expect(() => normalizeReading({ ...reading, at: 0 })).toThrow(/time/);
    expect(() => normalizeReading({ ...reading, source: " " })).toThrow(/source/);
  });
});
