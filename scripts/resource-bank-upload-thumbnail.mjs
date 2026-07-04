#!/usr/bin/env node
/**
 * Resource Bank thumbnail uploader.
 *
 * Inputs: a local image/contact-sheet path plus Resource Bank job and parent asset ids.
 * Outputs: a Convex storage-backed derived asset row.
 * Side effects: uploads one file to Convex storage and inserts one resourceBankAssets row.
 */

import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

const UPLOAD_URL_FUNCTION = "modules/resourceBank/assets:generateResourceAssetUploadUrl";
const ADD_ASSET_FUNCTION = "modules/resourceBank/assets:addResourceAsset";

function usage() {
  return `Usage:
  node scripts/resource-bank-upload-thumbnail.mjs --job-id <id> --parent-asset-id <id> --file <path> [options]

Options:
  --title <text>              Derived asset title. Defaults to file basename.
  --asset-role <role>         thumbnail|evidence|derived. Defaults to thumbnail.
  --asset-kind <kind>         image|screenshot|frame. Defaults to image.
  --source-url <url>          Original source URL.
  --canonical-url <url>       Canonical source URL.
  --tag <tag>                 Tag; repeat or comma-separate.
  --retention-note <text>     Retention note for the derived asset row.
  --push                      Pass --push to convex run before each mutation.
  --prod                      Pass --prod to convex run.
  --preview-name <name>       Pass --preview-name to convex run.
  --deployment-name <name>    Pass --deployment-name to convex run.
  --env-file <path>           Pass --env-file to convex run.
  --json                      Print JSON only.`;
}

function parseArgs(argv) {
  const options = {
    assetKind: "image",
    assetRole: "thumbnail",
    tags: [],
    json: false,
    push: false,
    prod: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`missing_value:${arg}`);
      index += 1;
      return value;
    };
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--job-id") {
      options.jobId = next();
    } else if (arg === "--parent-asset-id") {
      options.parentAssetId = next();
    } else if (arg === "--file") {
      options.file = next();
    } else if (arg === "--title") {
      options.title = next();
    } else if (arg === "--asset-role") {
      options.assetRole = next();
    } else if (arg === "--asset-kind") {
      options.assetKind = next();
    } else if (arg === "--source-url") {
      options.sourceUrl = next();
    } else if (arg === "--canonical-url") {
      options.canonicalUrl = next();
    } else if (arg === "--tag") {
      options.tags.push(
        ...next()
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );
    } else if (arg === "--retention-note") {
      options.retentionNote = next();
    } else if (arg === "--push") {
      options.push = true;
    } else if (arg === "--prod") {
      options.prod = true;
    } else if (arg === "--preview-name") {
      options.previewName = next();
    } else if (arg === "--deployment-name") {
      options.deploymentName = next();
    } else if (arg === "--env-file") {
      options.envFile = next();
    } else if (arg === "--json") {
      options.json = true;
    } else {
      throw new Error(`unknown_arg:${arg}`);
    }
  }
  return options;
}

function assertOptions(options) {
  if (options.help) return;
  if (!options.jobId) throw new Error("missing_job_id");
  if (!options.parentAssetId) throw new Error("missing_parent_asset_id");
  if (!options.file) throw new Error("missing_file");
  if (!["thumbnail", "evidence", "derived"].includes(options.assetRole)) {
    throw new Error(`invalid_asset_role:${options.assetRole}`);
  }
  if (!["image", "screenshot", "frame"].includes(options.assetKind)) {
    throw new Error(`invalid_asset_kind:${options.assetKind}`);
  }
}

function convexRunFlags(options) {
  const flags = [];
  if (options.push) flags.push("--push");
  if (options.prod) flags.push("--prod");
  if (options.previewName) flags.push("--preview-name", options.previewName);
  if (options.deploymentName) flags.push("--deployment-name", options.deploymentName);
  if (options.envFile) flags.push("--env-file", options.envFile);
  return flags;
}

function parseConvexJson(stdout, label) {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error(`${label}_empty_response`);
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/(\{[\s\S]*\}|"[^"]+"|\[[\s\S]*\])\s*$/);
    if (!match) throw new Error(`${label}_invalid_json:${trimmed.slice(0, 200)}`);
    return JSON.parse(match[1]);
  }
}

function convexRun(functionName, payload, options) {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["convex", "run", ...convexRunFlags(options), functionName, JSON.stringify(payload)],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`convex_run_failed:${functionName}:${result.stderr.trim()}`);
  }
  return parseConvexJson(result.stdout, functionName);
}

function mimeTypeForPath(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  return "application/octet-stream";
}

async function uploadFile(uploadUrl, filePath, mimeType) {
  const body = await readFile(filePath);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "content-type": mimeType },
    body,
  });
  if (!response.ok) {
    throw new Error(`storage_upload_failed:${response.status}:${await response.text()}`);
  }
  const payload = await response.json();
  if (!payload || typeof payload.storageId !== "string") {
    throw new Error("storage_upload_invalid_response");
  }
  return payload.storageId;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertOptions(options);
  if (options.help) {
    console.log(usage());
    return;
  }

  const filePath = resolve(options.file);
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) throw new Error(`not_a_file:${filePath}`);
  const mimeType = mimeTypeForPath(filePath);
  const uploadUrl = convexRun(UPLOAD_URL_FUNCTION, {}, options);
  const storageId = await uploadFile(uploadUrl, filePath, mimeType);
  const assetId = convexRun(
    ADD_ASSET_FUNCTION,
    {
      jobId: options.jobId,
      parentAssetId: options.parentAssetId,
      assetRole: options.assetRole,
      assetKind: options.assetKind,
      title: options.title ?? basename(filePath),
      sourceUrl: options.sourceUrl,
      canonicalUrl: options.canonicalUrl,
      storageId,
      localPath: filePath,
      mimeType,
      tags: options.tags,
      retentionNote:
        options.retentionNote ?? "Stored in Convex storage by Resource Bank upload script.",
    },
    options,
  );
  const result = {
    ok: true,
    assetId,
    storageId,
    file: filePath,
    mimeType,
    bytes: fileStat.size,
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Uploaded ${filePath}`);
    console.log(`storageId: ${storageId}`);
    console.log(`assetId: ${assetId}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
