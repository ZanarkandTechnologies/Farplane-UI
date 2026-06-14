#!/usr/bin/env node
/**
 * Prove office employee character renderers in a running Vite app.
 *
 * Inputs: FARPLANE_OFFICE_URL, FARPLANE_CHARACTER_RENDERER, FARPLANE_CHARACTER_PET_ID,
 * FARPLANE_CHARACTER_EMPLOYEE_ID, FARPLANE_CHARACTER_PROOF_DIR.
 * Outputs: screenshot, crop, and JSON proof with live renderer probe rows.
 * Side effects: sets/removes localStorage renderer override in the browser context.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const url = process.env.FARPLANE_OFFICE_URL || "http://127.0.0.1:5199/office";
const expectedRenderer = process.env.FARPLANE_CHARACTER_RENDERER || "sprite-sheet-2d";
const petId = process.env.FARPLANE_CHARACTER_PET_ID || "mini-kenji";
const employeeId = process.env.FARPLANE_CHARACTER_EMPLOYEE_ID || "";
const outDir =
  process.env.FARPLANE_CHARACTER_PROOF_DIR ||
  "experiments/office-character-renderers";
const timeoutMs = Number(process.env.FARPLANE_CHARACTER_TIMEOUT_MS || 60000);

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

await mkdir(outDir, { recursive: true });

const slug = timestampSlug();
const screenshotPath = path.join(outDir, `${slug}-office-character-renderers.png`);
const cropPath = path.join(outDir, `${slug}-office-character-renderers-crop.png`);
const proofPath = path.join(outDir, `${slug}-office-character-renderers.json`);

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-gl=swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 });
const consoleRows = [];
const requests = [];

page.on("console", (msg) => {
  if (["error", "warning"].includes(msg.type())) {
    consoleRows.push({ type: msg.type(), text: msg.text() });
  }
});
page.on("requestfinished", (request) => {
  const requestUrl = request.url();
  if (requestUrl.includes("/codex/pets/") || requestUrl.includes("/office")) {
    requests.push(requestUrl);
  }
});

await page.addInitScript(
  ({ renderer, pet, employee }) => {
    if (renderer === "sprite-sheet-2d") {
      window.localStorage.setItem("farplane.office.characterSpritePetId", pet);
      if (employee) {
        window.localStorage.setItem("farplane.office.characterSpriteEmployeeId", employee);
      } else {
        window.localStorage.removeItem("farplane.office.characterSpriteEmployeeId");
      }
      return;
    }
    window.localStorage.removeItem("farplane.office.characterSpritePetId");
    window.localStorage.removeItem("farplane.office.characterSpriteEmployeeId");
  },
  { renderer: expectedRenderer, pet: petId, employee: employeeId },
);

await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
await page.waitForFunction(
  () => !document.body.innerText.includes("Loading office") && document.querySelectorAll("canvas").length > 0,
  { timeout: timeoutMs },
);
await page.waitForFunction(
  () => Object.keys(window.__farplaneOfficeCharacterRenderers || {}).length > 0,
  { timeout: timeoutMs },
);

if (expectedRenderer === "sprite-sheet-2d") {
  await page.waitForFunction(
    () => {
      const rows = Object.values(window.__farplaneOfficeCharacterRenderers || {});
      return rows.length > 0 && rows.every((row) => row.rendererId === "sprite-sheet-2d");
    },
    { timeout: timeoutMs },
  );
}

await page.waitForTimeout(1200);

const proof = await page.evaluate(() => {
  const rows = Object.values(window.__farplaneOfficeCharacterRenderers || {});
  return {
    loadingVisible: document.body.innerText.includes("Loading office"),
    canvasCount: document.querySelectorAll("canvas").length,
    rendererRows: rows,
  };
});

await page.screenshot({ path: screenshotPath, fullPage: true });
await page.screenshot({
  path: cropPath,
  clip: { x: 760, y: 300, width: 1080, height: 390 },
});
await browser.close();

const rendererRows = proof.rendererRows;
const summary = {
  totalEmployees: rendererRows.length,
  byRenderer: countBy(rendererRows, "rendererId"),
  byStatus: countBy(rendererRows, "status"),
};
const failedRows = rendererRows.filter((row) => {
  if (expectedRenderer === "sprite-sheet-2d") {
    return row.rendererId !== "sprite-sheet-2d" || row.status === "fallback" || row.status === "error";
  }
  return row.rendererId !== "three-human";
});
const result = {
  url,
  expectedRenderer,
  petId: expectedRenderer === "sprite-sheet-2d" ? petId : "",
  employeeId,
  generatedAt: new Date().toISOString(),
  screenshotPath,
  cropPath,
  requests,
  consoleRows,
  summary,
  proof,
  failedRows,
  ok: failedRows.length === 0 && !proof.loadingVisible && proof.canvasCount > 0,
};

await writeFile(proofPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
console.log(JSON.stringify({ proofPath, screenshotPath, cropPath, summary, ok: result.ok }, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}
