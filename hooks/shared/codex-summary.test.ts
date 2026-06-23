import { describe, expect, it } from "vitest";
import {
  buildCodexSummaryPrompt,
  resolveCodexSummaryOptions,
  summarizeTrackedFileChangeWithCodex,
} from "./codex-summary";

describe("codex-summary", () => {
  it("builds a bounded tiny-label status prompt", () => {
    const prompt = buildCodexSummaryPrompt({
      projectPath: "/repo",
      filePath: "tickets/TASK-0004/progress.md",
      fileContentSnippet: "x".repeat(8_000),
      toolPayloadSnippet: "y".repeat(3_000),
    });

    expect(prompt).toContain("Return 2 to 4 words only");
    expect(prompt).toContain("Max 48 characters");
    expect(prompt).toContain("tickets/TASK-0004/progress.md");
    expect(prompt).toContain("<file_excerpt>");
    expect(prompt.length).toBeLessThan(8_500);
  });

  it("runs codex exec through injectable runner and normalizes the final message", async () => {
    const summary = await summarizeTrackedFileChangeWithCodex(
      {
        projectPath: "/repo",
        filePath: "progress.md",
        fileContentSnippet: "# Progress\n\n- Added summary-only hook proof.\n",
      },
      {
        model: "gpt-5.4-mini",
        runner: async (request) => {
          expect(request.args).toContain("exec");
          expect(request.args).toContain("--ephemeral");
          expect(request.args).toContain("--output-last-message");
          expect(request.args).toContain("--model");
          expect(request.prompt).toContain("progress.md");
          return '"Updated progress with summary-only hook proof."';
        },
      },
    );

    expect(summary).toBe("Updated progress with summary-only");
  });

  it("resolves the only summary-specific env override: model", () => {
    expect(
      resolveCodexSummaryOptions({
        FARPLANE_FILE_CHANGE_SUMMARY_MODEL: "gpt-test",
      }),
    ).toEqual({
      model: "gpt-test",
    });
  });
});
