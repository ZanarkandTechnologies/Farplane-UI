import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { projectFileContentType, readProjectFile } from "./project-file";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("project file bridge", () => {
  it("reads an existing file within the selected project", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "farplane-project-file-"));
    roots.push(root);
    await mkdir(path.join(root, "tickets", "TASK-0405"), { recursive: true });
    await writeFile(path.join(root, "tickets", "TASK-0405", "ticket.md"), "# Highlight proof\n");

    const result = await readProjectFile(root, "tickets/TASK-0405/ticket.md");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bytes.toString("utf-8")).toContain("Highlight proof");
  });

  it("rejects traversal, absolute refs, missing files, and non-absolute project roots", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "farplane-project-file-"));
    roots.push(root);

    await expect(readProjectFile(root, "../secret.txt")).resolves.toEqual({
      ok: false,
      error: "invalid_ref",
    });
    await expect(readProjectFile(root, "/tmp/secret.txt")).resolves.toEqual({
      ok: false,
      error: "invalid_ref",
    });
    await expect(readProjectFile(root, "missing.md")).resolves.toEqual({
      ok: false,
      error: "file_not_found",
    });
    await expect(readProjectFile("relative", "ticket.md")).resolves.toEqual({
      ok: false,
      error: "invalid_project_path",
    });
  });

  it("does not follow a project symlink outside the selected root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "farplane-project-file-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "farplane-project-file-outside-"));
    roots.push(root, outside);
    await writeFile(path.join(outside, "secret.md"), "not project evidence\n");
    await symlink(path.join(outside, "secret.md"), path.join(root, "linked.md"));

    await expect(readProjectFile(root, "linked.md")).resolves.toEqual({
      ok: false,
      error: "invalid_ref",
    });
  });

  it("uses inline-readable content types for common evidence files", () => {
    expect(projectFileContentType("/tmp/ticket.md")).toBe("text/markdown; charset=utf-8");
    expect(projectFileContentType("/tmp/receipt.json")).toBe("application/json; charset=utf-8");
    expect(projectFileContentType("/tmp/trace.bin")).toBe("application/octet-stream");
  });
});
