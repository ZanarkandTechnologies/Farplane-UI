#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const url = process.env.FARPLANE_OFFICE_URL || "http://127.0.0.1:5199/office";
const loops = Number(process.env.FARPLANE_CLICK_LOOPS || 10);
const outDir = process.env.FARPLANE_CLICK_METRICS_DIR || "experiments/office-clickability";
const offsets = [
  [0, 0],
  [-18, 0],
  [18, 0],
  [0, -14],
  [0, 14],
  [-18, -14],
  [18, -14],
  [-18, 14],
  [18, 14],
];

function summarize(rows) {
  const total = rows.length;
  const hits = rows.filter((row) => row.hit).length;
  const byKind = Object.fromEntries(
    ["team", "employee"].map((kind) => {
      const subset = rows.filter((row) => row.kind === kind);
      return [
        kind,
        {
          total: subset.length,
          hits: subset.filter((row) => row.hit).length,
          hitRate: subset.length > 0 ? subset.filter((row) => row.hit).length / subset.length : 0,
        },
      ];
    }),
  );
  return { total, hits, hitRate: total > 0 ? hits / total : 0, byKind };
}

const cdpUrl =
  process.env.FARPLANE_CLICK_CDP_URL ||
  execFileSync("agent-browser", ["--session", "farplane-ui", "get", "cdp-url"], {
    encoding: "utf-8",
  }).trim();
const browser = await chromium.connectOverCDP(cdpUrl);
const context = browser.contexts()[0] ?? (await browser.newContext());
let page = context.pages().find((candidate) => candidate.url().includes("/office"));
if (!page) {
  page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
} else if (!page.url().startsWith(url)) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
}
await page.waitForFunction(() => Boolean(window.__farplaneOfficeClickProbe?.targets?.length), {
  timeout: 45000,
});

const rows = [];
async function settleAfterReset() {
  await page.evaluate(() => window.__farplaneOfficeClickProbe?.reset());
  await page.waitForTimeout(120);
}

async function getVisibleTargets() {
  return page.evaluate(() => {
    const probe = window.__farplaneOfficeClickProbe;
    return (probe?.targets ?? [])
      .filter((target) => Number.isFinite(target.screen.x) && Number.isFinite(target.screen.y))
      .filter((target) => target.screen.x >= 0 && target.screen.x <= window.innerWidth)
      .filter((target) => target.screen.y >= 0 && target.screen.y <= window.innerHeight)
      .sort((a, b) => `${a.kind}:${a.label}`.localeCompare(`${b.kind}:${b.label}`));
  });
}

for (let loop = 1; loop <= loops; loop += 1) {
  await settleAfterReset();
  const targets = await getVisibleTargets();
  const sampledTargets = [
    ...targets.filter((target) => target.kind === "team").slice(0, 4),
    ...targets.filter((target) => target.kind === "employee").slice(0, 6),
  ];

  for (const target of sampledTargets) {
    for (const [dx, dy] of offsets) {
      await settleAfterReset();
      const liveTarget = (await getVisibleTargets()).find(
        (candidate) => candidate.kind === target.kind && candidate.id === target.id,
      );
      if (!liveTarget) {
        rows.push({
          loop,
          kind: target.kind,
          id: target.id,
          label: target.label,
          offset: { dx, dy },
          click: null,
          hit: false,
          state: await page.evaluate(() => window.__farplaneOfficeClickProbe?.state ?? null),
          error: "target-not-visible-after-reset",
        });
        continue;
      }
      await page.mouse.click(liveTarget.screen.x + dx, liveTarget.screen.y + dy);
      await page.waitForTimeout(80);
      const state = await page.evaluate(() => window.__farplaneOfficeClickProbe?.state ?? null);
      const topHits = await page.evaluate(
        ({ x, y }) => window.__farplaneOfficeClickProbe?.hitTest(x, y).slice(0, 5) ?? [],
        { x: liveTarget.screen.x + dx, y: liveTarget.screen.y + dy },
      );
      const expectedSelectedObjectId =
        target.kind === "employee" ? `employee-${target.id}` : null;
      const hit =
        target.kind === "team"
          ? state?.activeTeamId === target.id && state?.isTeamPanelOpen === true
          : state?.selectedObjectId === expectedSelectedObjectId;
      rows.push({
        loop,
        kind: target.kind,
        id: target.id,
        label: target.label,
        offset: { dx, dy },
        click: { x: Math.round(liveTarget.screen.x + dx), y: Math.round(liveTarget.screen.y + dy) },
        hit,
        state,
        topHits,
      });
    }
  }
}

await browser.close();

const result = {
  url,
  loops,
  offsets,
  generatedAt: new Date().toISOString(),
  summary: summarize(rows),
  loopsSummary: Array.from({ length: loops }, (_, index) => {
    const loop = index + 1;
    return { loop, ...summarize(rows.filter((row) => row.loop === loop)) };
  }),
  rows,
};

await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
console.log(JSON.stringify({ outPath, summary: result.summary }, null, 2));
