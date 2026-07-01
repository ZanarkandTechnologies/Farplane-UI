import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  codexProjectIdFromPath,
  readFarplaneManifestTracked,
  resolveProjectHookConfig,
} from "./project-hook-config";

function writeHookConfigToml(root: string, lines: string[]): NodeJS.ProcessEnv {
  const stateRoot = path.join(root, "state");
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(
    path.join(stateRoot, "config.toml"),
    ["[hooks.file_change]", ...lines, ""].join("\n"),
  );
  return { FARPLANE_STATE_DIR: stateRoot } as NodeJS.ProcessEnv;
}

describe("project-hook-config", () => {
  it("derives stable Codex project ids from paths", () => {
    expect(codexProjectIdFromPath("/Users/Kenji/Farplane UI")).toBe(
      "codex-proj-users-kenji-farplane-ui",
    );
  });

  it("reads tracked files from the Farplane manifest", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-hook-config-"));
    try {
      mkdirSync(path.join(repo, "farplane"), { recursive: true });
      writeFileSync(
        path.join(repo, "farplane", "manifest.json"),
        JSON.stringify({
          standard: { tracked: ["farplane/goals.md", "docs/MEMORY.md", "tickets/archive/"] },
          optional: { tracked: ["scripts/pre_push_check.sh"] },
        }),
      );

      expect(readFarplaneManifestTracked(repo)).toEqual([
        "farplane/goals.md",
        "docs/MEMORY.md",
        "scripts/pre_push_check.sh",
      ]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("prefers env pattern overrides over saved config and manifest files", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-hook-config-"));
    try {
      mkdirSync(path.join(repo, "farplane"), { recursive: true });
      writeFileSync(
        path.join(repo, "farplane", "manifest.json"),
        JSON.stringify({ standard: { tracked: ["docs/MEMORY.md"] } }),
      );
      const env = writeHookConfigToml(repo, ['customPatterns = ["tickets/*/progress.md"]']);

      const config = resolveProjectHookConfig(repo, {
        ...env,
        FARPLANE_FILE_CHANGE_PATTERNS: "package.json,docs/**/*.md",
      } as NodeJS.ProcessEnv);

      expect(config.patterns).toEqual(["package.json", "docs/**/*.md"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("keeps built-in hook patterns when canonical manifest paths are selected", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-hook-config-"));
    try {
      mkdirSync(path.join(repo, "farplane"), { recursive: true });
      writeFileSync(
        path.join(repo, "farplane", "manifest.json"),
        JSON.stringify({ standard: { tracked: ["docs/MEMORY.md"] } }),
      );
      const env = writeHookConfigToml(repo, [
        'selectedManifestPaths = ["docs/MEMORY.md"]',
        'customPatterns = ["custom/*.md"]',
      ]);

      const config = resolveProjectHookConfig(repo, env);

      expect(config.patterns).toEqual(
        expect.arrayContaining([
          "tickets/*/ticket.md",
          "tickets/*/progress.md",
          "farplane/*.md",
          "docs/MEMORY.md",
          "custom/*.md",
        ]),
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("reads canonical hooks config from Farplane config.toml only", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-hook-config-"));
    try {
      mkdirSync(path.join(repo, "farplane"), { recursive: true });
      mkdirSync(path.join(repo, ".farplane", "hooks"), { recursive: true });
      writeFileSync(
        path.join(repo, "farplane", "manifest.json"),
        JSON.stringify({ standard: { tracked: ["docs/MEMORY.md"] } }),
      );
      const env = writeHookConfigToml(repo, ['customPatterns = ["canonical/*.md"]']);

      const config = resolveProjectHookConfig(repo, env);
      expect(config.configPath).toBe(path.join(repo, "state", "config.toml"));
      expect(config.patterns).toEqual(expect.arrayContaining(["canonical/*.md"]));
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("reads summary bubble enablement from saved project config", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-hook-config-"));
    try {
      mkdirSync(path.join(repo, "farplane"), { recursive: true });
      writeFileSync(
        path.join(repo, "farplane", "manifest.json"),
        JSON.stringify({ standard: { tracked: ["docs/MEMORY.md"] } }),
      );
      const env = writeHookConfigToml(repo, ["summaryEnabled = false"]);

      expect(resolveProjectHookConfig(repo, env).summaryEnabled).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("disables summary bubbles by default and supports an env opt-in", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-hook-config-"));
    try {
      mkdirSync(path.join(repo, "farplane"), { recursive: true });
      writeFileSync(
        path.join(repo, "farplane", "manifest.json"),
        JSON.stringify({ standard: { tracked: ["docs/MEMORY.md"] } }),
      );

      expect(resolveProjectHookConfig(repo, {} as NodeJS.ProcessEnv).summaryEnabled).toBe(false);
      expect(
        resolveProjectHookConfig(repo, {
          FARPLANE_FILE_CHANGE_SUMMARY_ENABLED: "1",
        } as NodeJS.ProcessEnv).summaryEnabled,
      ).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("reads summary debounce from saved project config and env override", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "farplane-hook-config-"));
    try {
      mkdirSync(path.join(repo, "farplane"), { recursive: true });
      writeFileSync(
        path.join(repo, "farplane", "manifest.json"),
        JSON.stringify({ standard: { tracked: ["docs/MEMORY.md"] } }),
      );
      const env = writeHookConfigToml(repo, ["summaryDebounceMs = 12000"]);

      expect(resolveProjectHookConfig(repo, env).summaryDebounceMs).toBe(12_000);
      expect(
        resolveProjectHookConfig(repo, {
          ...env,
          FARPLANE_FILE_CHANGE_SUMMARY_DEBOUNCE_MS: "4000",
        } as NodeJS.ProcessEnv).summaryDebounceMs,
      ).toBe(4_000);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
