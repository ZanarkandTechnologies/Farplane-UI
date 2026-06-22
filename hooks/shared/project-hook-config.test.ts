import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readFarplaneManifestTracked, resolveProjectHookConfig } from "./project-hook-config";

describe("project-hook-config", () => {
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
      mkdirSync(path.join(repo, ".farplane", "hooks"), { recursive: true });
      writeFileSync(
        path.join(repo, "farplane", "manifest.json"),
        JSON.stringify({ standard: { tracked: ["docs/MEMORY.md"] } }),
      );
      writeFileSync(
        path.join(repo, ".farplane", "hooks", "config.json"),
        JSON.stringify({ customPatterns: ["tickets/*/progress.md"] }),
      );

      const config = resolveProjectHookConfig(repo, {
        FARPLANE_FILE_CHANGE_PATTERNS: "package.json,docs/**/*.md",
      } as NodeJS.ProcessEnv);

      expect(config.patterns).toEqual(["package.json", "docs/**/*.md"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
