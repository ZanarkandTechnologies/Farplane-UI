import type { FarplaneConfigFile, FarplaneProjectConfig } from "./config-types";

export function findConfigFile(
  config: FarplaneProjectConfig | null | undefined,
  kindOrPath: string,
): FarplaneConfigFile | null {
  return config?.files.find((file) => file.kind === kindOrPath || file.path === kindOrPath) ?? null;
}

export function getConfigSection(
  file: FarplaneConfigFile | null | undefined,
  title: string,
): string {
  const normalized = title.trim().toLowerCase();
  return (
    file?.sections.find((section) => section.title.trim().toLowerCase() === normalized)?.body ?? ""
  );
}

export function parseMarkdownTable(markdown: string): string[][] {
  const rows = markdown
    .split(/\r?\n/g)
    .filter((line) => line.trim().startsWith("|") && line.trim().endsWith("|"))
    .map((line) =>
      line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim().replace(/^`|`$/g, "")),
    )
    .filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/.test(cell)));
  return rows.length > 1 ? rows : [];
}
