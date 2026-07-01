/**
 * GATEWAY COMMANDS
 * ================
 * Operator commands for spawning local Farplane communication adapters.
 *
 * KEY CONCEPTS:
 * - CLI owns the operator entrypoint; adapter implementations can remain repo scripts.
 * - Telegram config is read from ~/.farplane/config.toml by default.
 */

import { spawn } from "node:child_process";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
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
  send?: {
    artifact?: string;
    document?: string;
    file?: string;
    parseMode?: string;
    sessionId?: string;
    text?: string;
    threadId?: string;
    title?: string;
  };
  once?: boolean;
  dryRun?: boolean;
  checkConfig?: boolean;
  propagateSignal?: boolean;
};

type TelegramDaemonPaths = {
  daemonDir: string;
  errLogPath: string;
  label: string;
  outLogPath: string;
  plistPath: string;
  repoRoot: string;
  runnerPath: string;
};

const TELEGRAM_DAEMON_LABEL = "com.farplane.telegram-gateway";

function requireHomeDir(): string {
  const home = process.env.HOME?.trim() || os.homedir();
  if (!home) throw new Error("missing_home_directory");
  return home;
}

function launchdTarget(): string {
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  if (typeof uid !== "number") throw new Error("launchd_requires_unix_uid");
  return `gui/${uid}`;
}

function telegramDaemonPaths(cwd = resolveRepoRoot()): TelegramDaemonPaths {
  const home = requireHomeDir();
  const daemonDir = path.join(home, ".farplane", "telegram-gateway");
  return {
    daemonDir,
    errLogPath: path.join(daemonDir, "launchd.err.log"),
    label: TELEGRAM_DAEMON_LABEL,
    outLogPath: path.join(daemonDir, "launchd.out.log"),
    plistPath: path.join(home, "Library", "LaunchAgents", `${TELEGRAM_DAEMON_LABEL}.plist`),
    repoRoot: path.resolve(cwd),
    runnerPath: path.join(daemonDir, "run-gateway.sh"),
  };
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function shellDoubleQuote(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("$", "\\$").replaceAll("`", "\\`")}"`;
}

function buildTelegramDaemonRunner(paths: TelegramDaemonPaths): string {
  return `#!/bin/zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export FARPLANE_REPO_ROOT=${shellDoubleQuote(paths.repoRoot)}

if [[ -f "$HOME/.codex/private/telegram.env" ]]; then
  set -a
  source "$HOME/.codex/private/telegram.env"
  set +a
fi

cd "$FARPLANE_REPO_ROOT"
exec npm run --workspace @farplane/cli shell -- gateway telegram "$@"
`;
}

function buildTelegramDaemonPlist(paths: TelegramDaemonPaths): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(paths.label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(paths.runnerPath)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${xmlEscape(paths.outLogPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(paths.errLogPath)}</string>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(paths.repoRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>FARPLANE_REPO_ROOT</key>
    <string>${xmlEscape(paths.repoRoot)}</string>
  </dict>
</dict>
</plist>
`;
}

async function ensureTelegramDaemonFiles(paths: TelegramDaemonPaths): Promise<void> {
  await mkdir(paths.daemonDir, { recursive: true });
  await mkdir(path.dirname(paths.plistPath), { recursive: true });
  await writeFile(paths.runnerPath, buildTelegramDaemonRunner(paths), "utf8");
  await chmod(paths.runnerPath, 0o700);
  await writeFile(paths.plistPath, buildTelegramDaemonPlist(paths), "utf8");
}

async function runCommand(
  command: string,
  args: string[],
  opts: { allowFailure?: boolean } = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", (error) => {
      if (opts.allowFailure) resolve();
      else reject(error);
    });
    child.on("exit", (code, signal) => {
      if (signal) {
        if (opts.allowFailure) resolve();
        else reject(new Error(`${command}_terminated:${signal}`));
        return;
      }
      if ((code ?? 1) !== 0 && !opts.allowFailure) {
        reject(new Error(`${command}_failed:${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

async function runTelegramDaemonAction(
  action: "install" | "start" | "restart" | "stop" | "status" | "logs",
): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("telegram_daemon_requires_macos_launchd");
  }

  const paths = telegramDaemonPaths();
  const target = launchdTarget();
  const service = `${target}/${paths.label}`;

  if (action === "logs") {
    console.log(cliSection("Telegram Gateway Daemon Logs"));
    console.log(cliDim(paths.outLogPath));
    await runCommand("tail", ["-f", paths.outLogPath]);
    return;
  }

  if (action === "status") {
    console.log(cliSection("Telegram Gateway Daemon Status"));
    await runCommand("launchctl", ["print", service]);
    console.log("");
    console.log(cliDim(`stdout: ${paths.outLogPath}`));
    console.log(cliDim(`stderr: ${paths.errLogPath}`));
    return;
  }

  if (action === "stop") {
    await runCommand("launchctl", ["bootout", target, paths.plistPath], { allowFailure: true });
    console.log(cliBlue("Telegram gateway daemon stopped."));
    return;
  }

  await ensureTelegramDaemonFiles(paths);
  await runCommand("plutil", ["-lint", paths.plistPath]);

  if (action === "install") {
    console.log(cliBlue(`Telegram gateway daemon files installed at ${paths.plistPath}`));
    return;
  }

  if (action === "restart") {
    await runCommand("launchctl", ["bootout", target, paths.plistPath], { allowFailure: true });
  }

  await runCommand("launchctl", ["bootstrap", target, paths.plistPath], {
    allowFailure: action === "start",
  });
  await runCommand("launchctl", ["kickstart", "-k", service]);
  console.log(
    cliBlue(`Telegram gateway daemon ${action === "restart" ? "restarted" : "started"}.`),
  );
  console.log(cliDim(`Status: npm run shell -- gateway telegram daemon status`));
}

export async function startTelegramGateway(
  options: StartTelegramGatewayOptions = {},
): Promise<void> {
  const cwd = options.cwd ?? resolveRepoRoot();
  const args = ["scripts/telegram-gateway.ts"];
  if (options.send) {
    args.push("--send");
    if (options.send.threadId) args.push("--thread-id", options.send.threadId);
    if (options.send.sessionId) args.push("--session-id", options.send.sessionId);
    if (options.send.text) args.push("--text", options.send.text);
    if (options.send.file) args.push("--file", options.send.file);
    if (options.send.document) args.push("--document", options.send.document);
    if (options.send.artifact) args.push("--artifact", options.send.artifact);
    if (options.send.title) args.push("--title", options.send.title);
    if (options.send.parseMode) args.push("--parse-mode", options.send.parseMode);
  }
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

  const telegram = gateway
    .command("telegram")
    .description("Run the local Telegram reply gateway")
    .option("--once", "Poll once and exit", false)
    .option("--dry-run", "Resolve updates without sending Codex turns", false)
    .option("--check-config", "Check config without polling Telegram", false)
    .action(async (opts: { once?: boolean; dryRun?: boolean; checkConfig?: boolean }) => {
      console.log(cliSection("Telegram Gateway"));
      console.log(cliDim("Config: ~/.farplane/config.toml"));
      console.log(cliBlue("Stop a long-running gateway with Ctrl+C."));
      console.log("");
      await startTelegramGateway({
        once: Boolean(opts.once),
        dryRun: Boolean(opts.dryRun),
        checkConfig: Boolean(opts.checkConfig),
      });
    });

  telegram
    .command("send")
    .description("Send a replyable Telegram notification and persist its gateway route")
    .option("--thread-id <threadId>", "Codex thread id to route Telegram replies to")
    .option("--session-id <sessionId>", "Codex session/thread id to route replies to")
    .option("--text <text>", "Telegram message text")
    .option("--file <path>", "Path to a file containing Telegram message text")
    .option("--document <path>", "Path to a local file to send as a Telegram document")
    .option("--artifact <path>", "Alias for --document")
    .option("--title <title>", "Short local mapping title")
    .option(
      "--parse-mode <mode>",
      "Telegram parse mode: none, Markdown, MarkdownV2, or HTML",
      "none",
    )
    .action(async (opts: NonNullable<StartTelegramGatewayOptions["send"]>) => {
      await startTelegramGateway({ send: opts });
    });

  const daemon = telegram
    .command("daemon")
    .description("Manage the macOS launchd Telegram gateway daemon");

  daemon
    .command("install")
    .description("Install or update the Telegram gateway LaunchAgent files")
    .action(async () => runTelegramDaemonAction("install"));

  daemon
    .command("start")
    .description("Install if needed, then start the Telegram gateway daemon")
    .action(async () => runTelegramDaemonAction("start"));

  daemon
    .command("restart")
    .description("Install/update, then restart the Telegram gateway daemon")
    .action(async () => runTelegramDaemonAction("restart"));

  daemon
    .command("stop")
    .description("Stop the Telegram gateway daemon")
    .action(async () => runTelegramDaemonAction("stop"));

  daemon
    .command("status")
    .description("Print launchd status for the Telegram gateway daemon")
    .action(async () => runTelegramDaemonAction("status"));

  daemon
    .command("logs")
    .description("Tail Telegram gateway daemon stdout logs")
    .action(async () => runTelegramDaemonAction("logs"));
}
