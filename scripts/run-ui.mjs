/**
 * Shared one-command office entrypoint used by pnpm and farplane ui start.
 * Starts/reuses Codex + YouTube analysis before Vite and owns foreground cleanup.
 * Uses the installed tsx loader to reuse the CLI lifecycle without a second daemon.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tsImport } from "tsx/esm/api";
import { launchOffice } from "./office-launcher.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = path.join(repoRoot, "ui");
const requireFromUi = createRequire(path.join(uiRoot, "package.json"));
const vitePackagePath = requireFromUi.resolve("vite/package.json");
const viteBinPath = path.join(path.dirname(vitePackagePath), "bin", "vite.js");
const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
const portIndex = args.indexOf("--port");
const port = Number(portIndex >= 0 ? args[portIndex + 1] : args.find((arg) => arg.startsWith("--port="))?.slice(7) ?? 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid office --port");

const { startYoutubeExtensionRuntime, releaseYoutubeExtensionRuntime } = await tsImport(
  "../cli/youtube-extension-runtime.ts", import.meta.url,
);

async function probeOffice() {
  const available = await new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
  if (available) return "absent";
  try {
    const response = await fetch(`http://127.0.0.1:${port}/codex/app-server/health`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return "conflict";
    const body = await response.json();
    if (typeof body.configured !== "boolean" || !["websocket", "missing"].includes(body.transport)) return "conflict";
    return body.configured ? "ready" : "unconfigured";
  } catch { return "conflict"; }
}

const env = { ...process.env };
if (!env.CODEX_APP_SERVER_URL && !env.VITE_CODEX_APP_SERVER_URL && !env.FARPLANE_CODEX_APP_SERVER_URL) {
  // Vite resolves saved Farplane configuration before process environment.
  env.CODEX_APP_SERVER_URL = "ws://127.0.0.1:47892";
}
process.exitCode = await launchOffice({
  startRuntime: startYoutubeExtensionRuntime,
  releaseRuntime: releaseYoutubeExtensionRuntime,
  probeOffice,
  startVite: () => spawn(process.execPath, [viteBinPath, "--config", "vite.config.ts", "--strictPort", ...args], {
    cwd: uiRoot, env, stdio: "inherit",
  }),
  signIn: process.stdin.isTTY ? (signal) => new Promise((resolve, reject) => {
    const child = spawn("codex", ["login"], { stdio: "inherit", env: process.env, signal });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Codex sign-in did not complete.")));
  }) : undefined,
});
