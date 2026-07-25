import path from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";

export type ProjectFileResult =
  | { ok: true; bytes: Buffer; filePath: string }
  | { ok: false; error: "invalid_project_path" | "invalid_ref" | "file_not_found" };

export async function readProjectFile(
  projectPath: string,
  ref: string,
): Promise<ProjectFileResult> {
  if (!path.isAbsolute(projectPath) || projectPath.includes("\0")) {
    return { ok: false, error: "invalid_project_path" };
  }
  if (!ref || ref.includes("\0") || path.isAbsolute(ref)) {
    return { ok: false, error: "invalid_ref" };
  }

  try {
    const root = await realpath(path.resolve(projectPath));
    const requestedPath = path.resolve(root, ref);
    const requestedRelative = path.relative(root, requestedPath);
    if (
      !requestedRelative ||
      requestedRelative.startsWith("..") ||
      path.isAbsolute(requestedRelative)
    ) {
      return { ok: false, error: "invalid_ref" };
    }
    const filePath = await realpath(requestedPath);
    const relative = path.relative(root, filePath);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      return { ok: false, error: "invalid_ref" };
    }
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return { ok: false, error: "file_not_found" };
    return { ok: true, bytes: await readFile(filePath), filePath };
  } catch {
    return { ok: false, error: "file_not_found" };
  }
}

export function projectFileContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".md":
    case ".mdx":
      return "text/markdown; charset=utf-8";
    case ".json":
    case ".jsonl":
      return "application/json; charset=utf-8";
    case ".yaml":
    case ".yml":
      return "application/yaml; charset=utf-8";
    case ".txt":
    case ".log":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
