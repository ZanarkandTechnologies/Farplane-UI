import { describe, expect, it } from "vitest";
import {
  buildCodexSummaryPrompt,
  resolveCodexSummaryOptions,
  summarizeTrackedFileChangeWithCodex,
} from "./codex-summary";

describe("codex-summary", () => {
  it("builds a bounded one-sentence status prompt", () => {
    const prompt = buildCodexSummaryPrompt({
      projectPath: "/repo",
      filePath: "tickets/TASK-0004/progress.md",
      fileContentSnippet: "x".repeat(8_000),
      toolPayloadSnippet: "y".repeat(3_000),
    });

    expect(prompt).toContain("Max 140 characters");
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
        executable: "codex",
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

    expect(summary).toBe("Updated progress with summary-only hook proof.");
  });

  it("supports local OSS provider options without forcing a hosted model", async () => {
    await summarizeTrackedFileChangeWithCodex(
      {
        projectPath: "/repo",
        filePath: "goals.md",
        fileContentSnippet: "# Goals\n",
      },
      {
        useOss: true,
        localProvider: "ollama",
        model: "ignored-hosted-model",
        runner: async (request) => {
          expect(request.args).toContain("--oss");
          expect(request.args).toContain("--local-provider");
          expect(request.args).toContain("ollama");
          expect(request.args).not.toContain("--model");
          return "Updated goals.";
        },
      },
    );
  });

  it("resolves env overrides for executable, model, local provider, and timeout", () => {
    expect(
      resolveCodexSummaryOptions({
        FARPLANE_CODEX_EXECUTABLE: "/bin/codex",
        FARPLANE_FILE_CHANGE_SUMMARY_MODEL: "gpt-test",
        FARPLANE_FILE_CHANGE_SUMMARY_OSS: "1",
        FARPLANE_FILE_CHANGE_SUMMARY_LOCAL_PROVIDER: "ollama",
        FARPLANE_FILE_CHANGE_SUMMARY_TIMEOUT_MS: "1234",
      }),
    ).toEqual({
      executable: "/bin/codex",
      model: "gpt-test",
      useOss: true,
      localProvider: "ollama",
      timeoutMs: 1234,
    });
  });
});
