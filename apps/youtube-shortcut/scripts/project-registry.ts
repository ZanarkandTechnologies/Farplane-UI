/** Centralizes validated project records from the local company sidecar. */
import { readFile } from "node:fs/promises";

export type RegisteredProject = {
  id: string;
  name: string;
  archived: boolean;
  trackingContext: string;
};

type CompanySidecar = {
  projects?: Array<{
    id?: unknown;
    name?: unknown;
    status?: unknown;
    trackingContext?: unknown;
  }>;
};

export async function readRegisteredProjects(
  companyPath: string,
): Promise<RegisteredProject[]> {
  try {
    const company = JSON.parse(await readFile(companyPath, "utf8")) as CompanySidecar;
    return (Array.isArray(company.projects) ? company.projects : [])
      .map((project): RegisteredProject | null => {
        const id = typeof project.id === "string" ? project.id.trim() : "";
        const name =
          typeof project.name === "string" && project.name.trim()
            ? project.name.trim()
            : id;
        if (!id || !name) return null;
        return {
          id,
          name,
          archived: project.status === "archived",
          trackingContext:
            typeof project.trackingContext === "string"
              ? project.trackingContext.trim()
              : "",
        };
      })
      .filter((project): project is RegisteredProject => project !== null);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
