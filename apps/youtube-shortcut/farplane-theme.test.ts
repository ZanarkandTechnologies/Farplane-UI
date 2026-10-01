import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FARPLANE_DARK, themeVars } from "./farplane-theme.js";

/** Farplane-UI's `.dark` block, with var(--nexus-*) references resolved within it. */
function uiDarkTokens(): Record<string, string> {
  const css = readFileSync(new URL("../../ui/src/styles.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf(".dark {"), css.indexOf("}", css.indexOf(".dark {")));
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) tokens[name] = value.trim();
  for (const [name, value] of Object.entries(tokens)) {
    const ref = /^var\(--([\w-]+)\)$/.exec(value);
    if (ref && tokens[ref[1]]) tokens[name] = tokens[ref[1]];
  }
  return tokens;
}

test("the extension's theme is Farplane-UI's dark theme", () => {
  const ui = uiDarkTokens();
  for (const name of ["background", "foreground", "card", "primary", "primary-foreground", "muted", "muted-foreground", "accent", "border", "ring", "destructive"] as const) {
    assert.equal(FARPLANE_DARK[name], ui[name], `--${name} matches ui/src/styles.css`);
  }
});

test("the theme renders as plain or prefixed custom properties", () => {
  assert.match(themeVars(), /^--background:oklch\([^)]+\);--foreground:/);
  assert.match(themeVars("farplane-"), /--farplane-primary:#6f918f;/);
  assert.doesNotMatch(themeVars(), /43\.6627/, "no copper primary left over");
});
