/**
 * Post-build gate: the Convex deployment the bridge talks to must accept the same
 * arguments as the Convex source the bridge was built against.
 */
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";
import { resolveConvexUrl } from "./video-intelligence-cloud.js";

const APP_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FARPLANE_UI_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

type DeployedFunction = { identifier: string; functionType: string; args: unknown };

/** Convex module files the bridge references, e.g. `modules/videoIntelligence/videos`. */
async function bridgeModuleFiles(): Promise<string[]> {
  const files = [
    ...(await readdir(APP_ROOT)).map((name) => join(APP_ROOT, name)),
    ...(await readdir(join(APP_ROOT, "scripts"))).map((name) => join(APP_ROOT, "scripts", name)),
  ].filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.includes("verify-"));
  const modules = new Set<string>();
  for (const path of files) {
    const source = await readFile(path, "utf8");
    for (const [, dir, file] of source.matchAll(/api\.modules\.(\w+)\.(\w+)/g)) {
      modules.add(`modules/${dir}/${file}`);
    }
    // Typed casts such as `(api.modules.videoIntelligence as …).comparisons`.
    for (const [, dir, file] of source.matchAll(/api\.modules\.(\w+)\s+as\b[\s\S]*?\)\.(\w+)/g)) {
      modules.add(`modules/${dir}/${file}`);
    }
  }
  return [...modules].sort();
}

/** Every registered function in those files, keyed as `convex function-spec` names them. */
async function sourceSpec(moduleFiles: string[]): Promise<Map<string, unknown>> {
  const spec = new Map<string, unknown>();
  for (const file of moduleFiles) {
    const module = await import(new URL(`convex/${file}.ts`, `file://${FARPLANE_UI_ROOT}`).href);
    for (const [name, value] of Object.entries(module)) {
      const registered = value as { exportArgs?: () => string };
      if (typeof registered?.exportArgs === "function") {
        spec.set(`${file}.js:${name}`, JSON.parse(registered.exportArgs()));
      }
    }
  }
  return spec;
}

async function deployedSpec(): Promise<{ url: string; functions: Map<string, DeployedFunction> }> {
  const { stdout } = await promisify(execFile)("npx", ["convex", "function-spec"], {
    cwd: FARPLANE_UI_ROOT,
    maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(stdout) as { url: string; functions: DeployedFunction[] };
  return {
    url: parsed.url,
    functions: new Map(parsed.functions.map((fn) => [fn.identifier, fn])),
  };
}

function topLevelDiff(source: unknown, deployed: unknown): string {
  const fields = (spec: unknown) =>
    ((spec as { value?: Record<string, unknown> })?.value ?? {}) as Record<string, unknown>;
  const [src, dep] = [fields(source), fields(deployed)];
  const keys = [...new Set([...Object.keys(src), ...Object.keys(dep)])].sort();
  const notes = keys.flatMap((key) =>
    !(key in dep)
      ? [`+${key} (source only)`]
      : !(key in src)
        ? [`-${key} (deployment only)`]
        : isDeepStrictEqual(src[key], dep[key])
          ? []
          : [`~${key} (shape differs)`],
  );
  return notes.join(", ") || "nested shape differs";
}

async function main() {
  const moduleFiles = await bridgeModuleFiles();
  const [source, deployed, bridgeUrl] = await Promise.all([
    sourceSpec(moduleFiles),
    deployedSpec(),
    resolveConvexUrl(),
  ]);
  const problems: string[] = [];
  if (new URL(bridgeUrl).origin !== new URL(deployed.url).origin) {
    problems.push(`the bridge uses ${bridgeUrl}, but the Convex CLI inspected ${deployed.url}`);
  }
  for (const [identifier, args] of source) {
    const live = deployed.functions.get(identifier);
    const liveArgs = typeof live?.args === "string" ? JSON.parse(live.args) : live?.args;
    if (!live) problems.push(`${identifier} is not deployed`);
    else if (!isDeepStrictEqual(args, liveArgs)) {
      problems.push(`${identifier} args differ: ${topLevelDiff(args, liveArgs)}`);
    }
  }
  if (problems.length > 0) {
    console.error(
      `Convex contract check failed against ${deployed.url}:\n- ${problems.join("\n- ")}\n` +
        "Deploy the Convex source (from Farplane-UI: `npx convex dev --once`), then rebuild.",
    );
    process.exit(1);
  }
  console.log(
    `Convex contract OK: ${source.size} functions in ${moduleFiles.length} modules match ${deployed.url}.`,
  );
}

await main();
