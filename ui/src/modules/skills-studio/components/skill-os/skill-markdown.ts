/** Read-only presentation helpers for canonical skill Markdown files. */

export function stripMarkdownFrontmatter(markdown: string): string {
  if (!/^---\r?\n/.test(markdown)) return markdown;
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trimStart();
}
