/**
 * Resolve the Farplane-UI checkout for CLI-owned local launchers.
 *
 * Inputs: source or bundled CLI location plus an explicit test/operator override.
 * Outputs: the checkout root containing the expected launcher marker.
 * Side effects: read-only filesystem inspection.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveFarplaneUiRepoRoot(
  moduleUrl: string,
  moduleDir: string | undefined = typeof __dirname === "string" ? __dirname : undefined,
): string {
  const override = process.env.FARPLANE_REPO_ROOT?.trim();
  if (override) return path.resolve(override);
  const cliDir = moduleDir?.trim() || path.dirname(fileURLToPath(moduleUrl));
  let candidate = path.resolve(cliDir);
  while (true) {
    if (existsSync(path.join(candidate, "scripts", "run-ui.mjs"))) return candidate;
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  return path.resolve(cliDir, "..");
}
