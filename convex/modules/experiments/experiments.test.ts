import { describe, expect, it } from "vitest";
import {
  countOptions,
  fileSendToRow,
  fileTestToRow,
  newSendId,
  normalizeOptions,
  pickIndex,
  projectTest,
  startOptions,
} from "./model";

const fileTest = {
  id: "opener-question",
  title: "Question opener",
  status: "proposed",
  step: "sales",
  variable: "DM opener",
  metric: { label: "Replies", ref: "globex:replies", unit: "replies", direction: "maximize", baseline: 0.1, windowDays: 7 },
  why: { hypothesis: "A question gets more replies", expected: "+5 points", falsifier: null },
  options: [
    { id: "plain", label: "Plain hello", value: 0.1 },
    { id: "question", label: "Ask a question", value: null, metricSource: { kind: "whop_plan", ref: "plan_globex_a" } },
  ],
  owner: "sales-strategist",
  forName: null,
  source: "whiteboard",
};

describe("A/B test rules", () => {
  it("takes two or three kebab-case options with distinct ids", () => {
    expect(normalizeOptions([{ id: "a", label: "" }, { id: "b", label: "B" }])).toEqual([
      { id: "a", label: "a" },
      { id: "b", label: "B" },
    ]);
    expect(() => normalizeOptions([{ id: "a", label: "A" }])).toThrow(/two or three/);
    expect(() => normalizeOptions([{ id: "a", label: "A" }, { id: "Bad Id", label: "B" }])).toThrow(/two or three/);
    expect(() => normalizeOptions([{ id: "a", label: "A" }, { id: "a", label: "B" }])).toThrow(/differ/);
  });

  it("starting keeps a proposal's baseline and metric source by option id", () => {
    const proposed = fileTestToRow("globex", fileTest, 1).options;
    const started = startOptions([{ id: "plain", label: "Hi" }, { id: "question", label: "Q?" }], proposed);
    expect(started[0]).toMatchObject({ label: "Hi", value: 0.1 });
    expect(started[1].metricSource).toEqual({ kind: "whop_plan", ref: "plan_globex_a" });
    expect(startOptions(undefined, proposed)).toEqual(proposed);
  });

  it("counts sends plus each option's latest source totals", () => {
    const counts = countOptions(
      [{ id: "plain" }, { id: "question" }],
      [
        { option: "plain", success: true },
        { option: "plain", success: false },
        { option: "plain" },
        { option: "question", success: true },
      ],
      [{ option: "question", successes: 4, attempts: 20 }],
    );
    expect(counts).toEqual([
      { id: "plain", sends: 3, successes: 1 },
      { id: "question", sends: 21, successes: 5 },
    ]);
  });

  it("imports a file-store test leniently, as the office read it", () => {
    const row = fileTestToRow("globex", fileTest, 99);
    expect(row).toMatchObject({
      project: "globex",
      testId: "opener-question",
      step: "sales",
      status: "proposed",
      startedAt: null,
      forName: undefined,
      updatedAt: 99,
      metric: { label: "Replies", windowDays: 7, ref: "globex:replies", baseline: 0.1 },
    });
    const running = fileTestToRow("globex", { ...fileTest, status: undefined, startedAt: "2026-09-01T00:00:00.000Z" }, 99);
    expect(running.status).toBe("running");
    expect(running.startedAt).toBe(Date.parse("2026-09-01T00:00:00.000Z"));
    expect(() => fileTestToRow("globex", { ...fileTest, id: "Not Kebab" }, 1)).toThrow(/kebab/);
  });

  it("imports only sends with a send id, a time and a known option", () => {
    const ok = { id: "a1b2c3d4e5f6", at: "2026-09-02T10:00:00.000Z", option: "plain", success: true };
    expect(fileSendToRow("globex", "opener-question", ["plain", "question"], ok)).toEqual({
      project: "globex",
      testId: "opener-question",
      sendId: "a1b2c3d4e5f6",
      option: "plain",
      at: Date.parse(ok.at),
      success: true,
    });
    expect(fileSendToRow("globex", "t", ["plain"], { ...ok, id: "nothex" })).toBeNull();
    expect(fileSendToRow("globex", "t", ["plain"], { ...ok, option: "other" })).toBeNull();
    expect(fileSendToRow("globex", "t", ["plain"], { ...ok, at: "later" })).toBeNull();
  });

  it("projects the office's test shape with ISO times and the newest runs first", () => {
    const test = { ...fileTestToRow("globex", fileTest, 1), status: "running" as const, startedAt: Date.UTC(2026, 8, 1) };
    const sends = Array.from({ length: 60 }, (_, i) => ({
      project: "globex",
      testId: test.testId,
      sendId: i.toString(16).padStart(12, "0"),
      option: i % 2 ? "question" : "plain",
      at: Date.UTC(2026, 8, 2) + i,
      success: i % 3 === 0 ? true : undefined,
    }));
    const projected = projectTest(test, sends, []);
    expect(projected.startedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(projected.runs).toHaveLength(50);
    expect(projected.runs[0]).toMatchObject({ sendId: "00000000003b", option: "question", success: null });
    expect(projected.options.map((o) => [o.id, o.sends])).toEqual([["plain", 30], ["question", 30]]);
    expect(projected.defaultOption).toBeNull();
  });

  it("makes 12-hex send ids and even-split picks in range", () => {
    expect(newSendId()).toMatch(/^[a-f0-9]{12}$/);
    expect(newSendId(() => 0.999)).toBe("ffffffffffff");
    expect([0, 0.34, 0.67, 0.9999].map((r) => pickIndex(3, () => r))).toEqual([0, 1, 2, 2]);
  });
});
