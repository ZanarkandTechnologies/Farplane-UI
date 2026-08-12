export type SkillStudioSurface = "capabilities" | "library";

export function resolveSkillStudioSurface({
  initialFilter,
  surface,
}: {
  initialFilter: "all" | "evaluated" | "needs-care";
  surface: string | null;
}): SkillStudioSurface {
  if (surface === "capabilities" || surface === "library") return surface;
  return initialFilter === "all" ? "capabilities" : "library";
}
