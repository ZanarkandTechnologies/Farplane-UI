import { EventEmitter } from "node:events";
import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildConvexRunArgs,
  buildTastyPackArgs,
  registerResourceBankCommands,
  renderTastyPackText,
} from "./resource-bank-commands.js";

class MockChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = null;
}

describe("resource bank CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("builds compact tasty pack args from operator flags", () => {
    expect(
      buildTastyPackArgs({
        idea: " AI office intro ",
        timeframe: "past_month",
        tags: ["style:corporate,hook:first-3s"],
        outputTypes: ["reel,short-video"],
        audiences: ["founders"],
        limit: 7,
      }),
    ).toEqual({
      idea: "AI office intro",
      timeframe: "past_month",
      startAtMs: undefined,
      endAtMs: undefined,
      tags: ["style:corporate", "hook:first-3s"],
      outputType: undefined,
      outputTypes: ["reel", "short-video"],
      audience: undefined,
      audiences: ["founders"],
      ageRanges: undefined,
      industry: undefined,
      industries: undefined,
      customerRole: undefined,
      customerRoles: undefined,
      projectId: undefined,
      taskId: undefined,
      kinds: undefined,
      limit: 7,
    });
  });

  it("targets the existing Convex Tasty Pack query", () => {
    const args = buildConvexRunArgs({
      idea: "Launch reel",
      timeframe: "past_week",
      audience: "founders",
      outputType: "reel",
      limit: 5,
    });

    expect(args.slice(0, 3)).toEqual([
      "convex",
      "run",
      "modules/resourceBank/retrieval:createTastyPack",
    ]);
    expect(JSON.parse(args[3] ?? "{}")).toEqual({
      idea: "Launch reel",
      timeframe: "past_week",
      outputType: "reel",
      audience: "founders",
      limit: 5,
    });
  });

  it("renders a compact human summary", () => {
    const text = renderTastyPackText({
      request: { idea: "AI office", timeframe: "past_week" },
      captures: [
        {
          source: {
            title: "Corporate cold open",
            tastinessScore: 0.93,
            sourceHandle: "https://example.com/reel",
          },
          analysis: { whySaved: ["Operator liked the identity flip."] },
          elements: [{ kind: "hook", title: "Employee reveal hook", anchor: "0-3s" }],
        },
      ],
      meta: { captureCount: 1, timeframe: "past_week" },
    });

    expect(text).toContain("Resource Bank Tasty Pack");
    expect(text).toContain("Corporate cold open score=0.93");
    expect(text).toContain("Captures: 1");
    expect(text).toContain("https://example.com/reel");
    expect(text).toContain("Operator liked the identity flip");
    expect(text).toContain("hook: Employee reveal hook (0-3s)");
  });

  it("registers a CLI command that shells out through npx convex run", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const { registerResourceBankCommands: registerWithMock } = await import("./resource-bank-commands.js");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const program = new Command();
    registerWithMock(program);
    const parsePromise = program.parseAsync(
      [
        "resource-bank",
        "tasty-pack",
        "AI office intro",
        "--timeframe",
        "past_week",
        "--audience",
        "founders",
        "--output-type",
        "reel",
        "--json",
      ],
      { from: "user" },
    );
    child.stdout.emit(
      "data",
      Buffer.from(
        JSON.stringify({
          request: { idea: "AI office intro", timeframe: "past_week" },
          captures: [],
          meta: { captureCount: 0, timeframe: "past_week" },
        }),
      ),
    );
    child.emit("exit", 0, null);
    await parsePromise;

    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringMatching(/^npx(\.cmd)?$/),
      [
        "convex",
        "run",
        "modules/resourceBank/retrieval:createTastyPack",
        JSON.stringify({
          idea: "AI office intro",
          timeframe: "past_week",
          outputType: "reel",
          audience: "founders",
        }),
      ],
      expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] }),
    );
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(payload.request.idea).toBe("AI office intro");
  });

  it("exposes the bank alias", async () => {
    const child = new MockChild();
    const spawnMock = vi.fn(() => child);
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
    const { registerResourceBankCommands: registerWithMock } = await import("./resource-bank-commands.js");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const program = new Command();
    registerWithMock(program);
    const parsePromise = program.parseAsync(["bank", "pack", "--json"], { from: "user" });
    child.stdout.emit("data", Buffer.from(JSON.stringify({ captures: [] })));
    child.emit("exit", 0, null);
    await parsePromise;

    expect(spawnMock).toHaveBeenCalledOnce();
  });
});
