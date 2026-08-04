/**
 * Ownership: bounded server-side discovery of ticket-backed self-improvement Goal Packets.
 * Inputs: configured local project references. Outputs: raw packet Markdown for the pure UI parser.
 * Side effects: reads ticket.md through the ticket scanner, then program.md/progress.md only.
 * Invariants: resolved paths stay inside the project ticket root and one project failure never aborts peers.
 */
import path from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";

import { scanProjectTickets, type ProjectTicketScan } from "../cli/project-ticket-store";

export const SELF_IMPROVEMENT_PROJECT_CAP = 24;
export const SELF_IMPROVEMENT_RUN_CAP = 100;
export const SELF_IMPROVEMENT_FILE_BYTE_CAP = 256 * 1024;
export const SELF_IMPROVEMENT_TOTAL_BYTE_CAP = 2 * 1024 * 1024;

export type SelfImprovementProjectRef = {
  projectId: string;
  projectName: string;
  projectPath: string;
};

export type SelfImprovementRunPacket = {
  projectId: string;
  projectName: string;
  ticketId: string;
  ticketTitle: string;
  ticketUpdatedAt: number;
  ticketMarkdown: string;
  programMarkdown: string;
  progressMarkdown: string;
};

export type SelfImprovementReadIssue = {
  projectId: string;
  projectName: string;
  error: string;
};

export type SelfImprovementRunsPayload = {
  packets: SelfImprovementRunPacket[];
  issues: SelfImprovementReadIssue[];
  partial: boolean;
  truncated: boolean;
};

type ReadOptions = {
  scanTickets?: (projectPath: string) => Promise<ProjectTicketScan>;
  projectCap?: number;
  runCap?: number;
  totalByteCap?: number;
};

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function declaresSkillImprovement(programMarkdown: string): boolean {
  return (
    /^\s*(?:mode|loop_shape):\s*["']?skill_improvement["']?\s*$/im.test(programMarkdown) ||
    /^\s*-\s*Shape:\s*.*\bskill_improvement\b.*\bloop\b.*$/im.test(programMarkdown)
  );
}

async function readPacketFile(input: {
  filePath: string;
  projectRoot: string;
  remainingBytes: number;
  optional?: boolean;
}): Promise<{ text: string; bytes: number }> {
  try {
    const resolved = await realpath(input.filePath);
    if (!isWithin(input.projectRoot, resolved)) throw new Error("packet_path_outside_project");
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) throw new Error("packet_path_not_file");
    if (fileStat.size > SELF_IMPROVEMENT_FILE_BYTE_CAP) throw new Error("packet_file_too_large");
    if (fileStat.size > input.remainingBytes) throw new Error("packet_total_bytes_exceeded");
    return { text: await readFile(resolved, "utf-8"), bytes: fileStat.size };
  } catch (error) {
    if (input.optional && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return { text: "", bytes: 0 };
    }
    throw error;
  }
}

function normalizeProjectRefs(
  refs: readonly SelfImprovementProjectRef[],
  cap: number,
): { refs: SelfImprovementProjectRef[]; truncated: boolean } {
  const unique = new Map<string, SelfImprovementProjectRef>();
  for (const ref of refs) {
    if (!ref || typeof ref.projectPath !== "string" || !path.isAbsolute(ref.projectPath)) continue;
    const projectPath = path.resolve(ref.projectPath);
    if (projectPath.includes("\0")) continue;
    const key = projectPath.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, {
        projectId: String(ref.projectId || projectPath),
        projectName: String(ref.projectName || path.basename(projectPath)),
        projectPath,
      });
    }
  }
  const all = [...unique.values()];
  return { refs: all.slice(0, cap), truncated: all.length > cap };
}

export async function readSelfImprovementRuns(
  projectRefs: readonly SelfImprovementProjectRef[],
  options: ReadOptions = {},
): Promise<SelfImprovementRunsPayload> {
  const projectCap = Math.min(options.projectCap ?? SELF_IMPROVEMENT_PROJECT_CAP, SELF_IMPROVEMENT_PROJECT_CAP);
  const runCap = Math.min(options.runCap ?? SELF_IMPROVEMENT_RUN_CAP, SELF_IMPROVEMENT_RUN_CAP);
  const totalByteCap = Math.min(
    options.totalByteCap ?? SELF_IMPROVEMENT_TOTAL_BYTE_CAP,
    SELF_IMPROVEMENT_TOTAL_BYTE_CAP,
  );
  const normalized = normalizeProjectRefs(projectRefs, projectCap);
  const packets: SelfImprovementRunPacket[] = [];
  const issues: SelfImprovementReadIssue[] = [];
  let bytesRead = 0;
  let truncated = normalized.truncated;

  for (const project of normalized.refs) {
    if (packets.length >= runCap || bytesRead >= totalByteCap) {
      truncated = true;
      break;
    }
    try {
      const projectRoot = await realpath(project.projectPath);
      const ticketsRoot = path.join(projectRoot, "tickets");
      const scan = await (options.scanTickets ?? scanProjectTickets)(projectRoot);
      if (scan.issues.length > 0) {
        issues.push({
          projectId: project.projectId,
          projectName: project.projectName,
          error: `ticket_scan_partial:${scan.issues.length}`,
        });
      }

      for (const ticket of scan.tickets) {
        if (packets.length >= runCap) {
          truncated = true;
          break;
        }
        const ticketPath = path.resolve(ticket.filePath);
        const ticketDir = path.dirname(ticketPath);
        if (
          path.basename(ticketPath) !== "ticket.md" ||
          !isWithin(ticketsRoot, ticketPath) ||
          !/^TASK-\d{4,}$/i.test(path.basename(ticketDir))
        ) {
          issues.push({
            projectId: project.projectId,
            projectName: project.projectName,
            error: `unsafe_ticket_path:${ticket.ticketId}`,
          });
          continue;
        }

        const program = await readPacketFile({
          filePath: path.join(ticketDir, "program.md"),
          projectRoot,
          remainingBytes: totalByteCap - bytesRead,
          optional: true,
        });
        bytesRead += program.bytes;
        if (!declaresSkillImprovement(program.text)) continue;
        const progress = await readPacketFile({
          filePath: path.join(ticketDir, "progress.md"),
          projectRoot,
          remainingBytes: totalByteCap - bytesRead,
          optional: true,
        });
        bytesRead += progress.bytes;
        const ticketBytes = Buffer.byteLength(ticket.markdown, "utf-8");
        if (ticketBytes > SELF_IMPROVEMENT_FILE_BYTE_CAP || ticketBytes > totalByteCap - bytesRead) {
          truncated = true;
          throw new Error("packet_total_bytes_exceeded");
        }
        bytesRead += ticketBytes;
        packets.push({
          projectId: project.projectId,
          projectName: project.projectName,
          ticketId: ticket.ticketId,
          ticketTitle: ticket.title,
          ticketUpdatedAt: ticket.updatedAt,
          ticketMarkdown: ticket.markdown,
          programMarkdown: program.text,
          progressMarkdown: progress.text,
        });
      }
    } catch (error) {
      issues.push({
        projectId: project.projectId,
        projectName: project.projectName,
        error: error instanceof Error ? error.message : "self_improvement_project_read_failed",
      });
    }
  }

  return {
    packets,
    issues,
    partial: issues.length > 0 || truncated,
    truncated,
  };
}
