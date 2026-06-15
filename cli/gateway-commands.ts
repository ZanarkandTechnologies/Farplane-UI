/**
 * GATEWAY COMMANDS
 * ================
 * Operator commands for spawning local Farplane communication adapters.
 *
 * KEY CONCEPTS:
 * - CLI owns the operator entrypoint; adapter implementations can remain repo scripts.
 * - Telegram config is read from ~/.farplane/config.json by default.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { cliBlue, cliDim, cliSection } from "./cli-utils.js";

function tsxCommand(cwd: string): string {
  return path.join(cwd, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
}

function resolveRepoRoot(): string {
  const override = process.env.FARPLANE_REPO_ROOT?.trim();
  if (override) return path.resolve(override);
  const cliDir =
    typeof __dirname === "string" && __dirname.trim()
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(cliDir, "..");
}

export type StartTelegramGatewayOptions = {
  cwd?: string;
  once?: boolean;
  dryRun?: boolean;
  checkConfig?: boolean;
  propagateSignal?: boolean;
};

export async function startTelegramGateway(options: StartTelegramGatewayOptions = {}): Promise<void> {
  const cwd = options.cwd ?? resolveRepoRoot();
  const args = ["scripts/telegram-gateway.ts"];
  if (options.once) args.push("--once");
  if (options.dryRun) args.push("--dry-run");
  if (options.checkConfig) args.push("--check-config");
  const propagateSignal = options.propagateSignal !== false;
  const useShell = process.platform === "win32";
  const baseOpts = { cwd, stdio: "inherit" as const, env: process.env };

  await new Promise<void>((resolve, reject) => {
    const child = useShell
      ? spawn(`"${tsxCommand(cwd)}" ${args.join(" ")}`, [], { ...baseOpts, shell: true })
      : spawn(tsxCommand(cwd), args, baseOpts);

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        if (propagateSignal) {
          process.kill(process.pid, signal);
          return;
        }
        resolve();
        return;
      }
      if ((code ?? 1) !== 0) {
        reject(new Error(`telegram_gateway_failed:${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

export function registerGatewayCommands(program: Command): void {
  const gateway = program.command("gateway").description("Run local Farplane gateway adapters");

  gateway
    .command("telegram")
    .description("Run the local Telegram reply gateway")
    .option("--once", "Poll once and exit", false)
    .option("--dry-run", "Resolve updates without sending Codex turns", false)
    .option("--check-config", "Check config without polling Telegram", false)
    .action(async (opts: { once?: boolean; dryRun?: boolean; checkConfig?: boolean }) => {
      console.log(cliSection("Telegram Gateway"));
      console.log(cliDim("Config: ~/.farplane/config.json"));
      console.log(cliBlue("Stop a long-running gateway with Ctrl+C."));
      console.log("");
      await startTelegramGateway({
        once: Boolean(opts.once),
        dryRun: Boolean(opts.dryRun),
        checkConfig: Boolean(opts.checkConfig),
      });
    });
}
