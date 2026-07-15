#!/usr/bin/env node
/** TASK-0053 browser proof: exercises the office lifecycle and restores operator sidecars. */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { canonicalSidecarSnapshot } from "./lib/canonical-sidecar-snapshot.mjs";

const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const outDir = path.resolve(valueAfter("--out", "tickets/TASK-0053/artifacts/browser-qa"));
const baseUrl = valueAfter("--base-url", "http://127.0.0.1:5173");
const manifest = { task: "TASK-0053", baseUrl, startedAt: new Date().toISOString(), rows: [], artifacts: [] };
const stable = (value) => canonicalSidecarSnapshot({ settings: value, objects: [] });
const sidecarSnapshot = ({ settings, objects }) =>
  canonicalSidecarSnapshot({ settings, objects });
const record = (id, pass, evidence = {}) => {
  manifest.rows.push({ id, pass, evidence });
  if (!pass) throw new Error(`proof_failed:${id}`);
};
async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${url}:${response.status}:${JSON.stringify(payload)}`);
  return payload;
}

await mkdir(outDir, { recursive: true });
const originalSettings = (await jsonFetch(`${baseUrl}/openclaw/office-settings`)).settings;
const originalObjects = (await jsonFetch(`${baseUrl}/openclaw/office-objects`)).objects;
await writeFile(path.join(outDir, "sidecars-before.json"), `${JSON.stringify({ settings: originalSettings, objects: originalObjects }, null, 2)}\n`);
manifest.artifacts.push(path.join(outDir, "sidecars-before.json"));
let browser;
let failure = null;
const consoleErrors = [];

try {
  browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, colorScheme: "dark" });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const shot = async (name) => {
    const filename = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: filename });
    manifest.artifacts.push(filename);
  };
  const qa = (method, arg) => page.evaluate(([name, input]) => window.__FARPLANE_QA__?.[name]?.(input), [method, arg]);
  const kit = () => qa("getOfficeKitState");
  const camera = () => qa("getCameraState");

  await page.goto(`${baseUrl}/office`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__FARPLANE_QA__?.getOfficeKitState?.()), null, { timeout: 30_000 });
  await page.waitForFunction(() => !document.body.innerText.includes("Loading office"), null, { timeout: 30_000 });
  await shot("00-initial");

  record("builder-open", await qa("runCommand", "builder-mode") === true);
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.builderMode === true);
  const beforePreview = {
    settings: (await jsonFetch(`${baseUrl}/openclaw/office-settings`)).settings,
    objects: (await jsonFetch(`${baseUrl}/openclaw/office-objects`)).objects,
  };
  await page.getByRole("button", { name: "Preview" }).click();
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.uiStatus === "preview");
  const afterPreview = {
    settings: (await jsonFetch(`${baseUrl}/openclaw/office-settings`)).settings,
    objects: (await jsonFetch(`${baseUrl}/openclaw/office-objects`)).objects,
  };
  record(
    "preview-is-transient",
    sidecarSnapshot(beforePreview) === sidecarSnapshot(afterPreview),
  );
  await shot("01-preview");

  await page.getByRole("button", { name: /Equip|Reset kit/ }).click();
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.persisted?.status === "equipped");
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.uiStatus === "idle");
  await page.waitForFunction(async () => {
    const response = await fetch("/openclaw/office-objects");
    const payload = await response.json();
    const rooms = payload.objects?.filter((object) => object.meshType === "activity-landmark") ?? [];
    return rooms.length === 13 && rooms.every(
      (object) =>
        object.metadata?.uiBinding?.kind === "internalPanel" &&
        object.metadata?.roomFurnitureStyle === "executive-walnut-v1",
    );
  }, null, { timeout: 30_000 });
  const equippedSettings = (await jsonFetch(`${baseUrl}/openclaw/office-settings`)).settings;
  const equippedObjects = (await jsonFetch(`${baseUrl}/openclaw/office-objects`)).objects;
  const equippedSnapshot = sidecarSnapshot({ settings: equippedSettings, objects: equippedObjects });
  const equippedActivityRooms = equippedObjects.filter((object) => object.meshType === "activity-landmark");
  const expectedActivityPanelIds = new Set([
    "skill-rollout",
    "document-library",
    "resource-bank",
    "ceo-workbench",
    "evals",
    "harness",
    "skill-os",
    "organization",
    "user-communications",
    "raw-telemetry",
    "thread-data",
    "world",
  ]);
  record(
    "activity-room-panel-and-furniture-bindings",
    equippedActivityRooms.length === 13 &&
      equippedActivityRooms.every(
        (object) =>
          object.metadata?.uiBinding?.kind === "internalPanel" &&
          expectedActivityPanelIds.has(object.metadata.uiBinding.panelId) &&
          object.metadata?.roomFurnitureStyle === "executive-walnut-v1",
      ),
    equippedActivityRooms.map((object) => ({
      id: object.id,
      kind: object.metadata?.landmarkKind,
      panelId: object.metadata?.uiBinding?.panelId,
      furnitureStyle: object.metadata?.roomFurnitureStyle,
    })),
  );
  record("builder-close-after-equip", await qa("runCommand", "builder-mode") === true);
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.builderMode === false);
  await page.waitForTimeout(600);
  await shot("02-equipped-isometric");
  await writeFile(path.join(outDir, "sidecars-equipped.json"), `${JSON.stringify({ settings: equippedSettings, objects: equippedObjects }, null, 2)}\n`);
  manifest.artifacts.push(path.join(outDir, "sidecars-equipped.json"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.body.innerText.includes("Loading office"), null, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const state = window.__FARPLANE_QA__?.getOfficeKitState?.();
    return state?.persisted?.status === "equipped" && state?.semanticObjectSignature?.includes("command-commons");
  }, null, { timeout: 30_000 });
  await page.waitForFunction(async (expectedObjectCount) => {
    const response = await fetch("/openclaw/office-objects");
    const payload = await response.json();
    return payload.objects?.length === expectedObjectCount &&
      payload.objects.some(
        (object) =>
          object.meshType === "command-commons" &&
          object.metadata?.officeKit?.prefabId === "command-commons",
      );
  }, equippedObjects.length, { timeout: 30_000 });
  const reloadedObjects = (await jsonFetch(`${baseUrl}/openclaw/office-objects`)).objects;
  await writeFile(path.join(outDir, "sidecars-reloaded.json"), `${JSON.stringify({ objects: reloadedObjects }, null, 2)}\n`);
  manifest.artifacts.push(path.join(outDir, "sidecars-reloaded.json"));
  const reloadedSettings = (await jsonFetch(`${baseUrl}/openclaw/office-settings`)).settings;
  const reloadedSnapshot = sidecarSnapshot({ settings: reloadedSettings, objects: reloadedObjects });
  record("equip-reload-stable", reloadedSnapshot === equippedSnapshot, {
    kit: await kit(),
    equippedSnapshot,
    reloadedSnapshot,
  });

  record("builder-open-for-customization", await qa("runCommand", "builder-mode") === true);
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.builderMode === true);
  const layoutBeforeCustomization = (await jsonFetch(`${baseUrl}/openclaw/office-settings`)).settings.officeLayout.tiles.join("|");
  record("builder-apply-customization", await qa("applyBuilderCustomizationFixture") === true);
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.persisted?.status === "customized");
  const customizedSettings = (await jsonFetch(`${baseUrl}/openclaw/office-settings`)).settings;
  const customizedLayoutSignature = customizedSettings.officeLayout.tiles.join("|");
  record("builder-mutation-persisted", customizedSettings.layoutStrategy === "manual" && customizedLayoutSignature !== layoutBeforeCustomization, customizedSettings.officeKit);
  await shot("03-builder-customized");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.persisted?.status === "customized", null, { timeout: 30_000 });
  record("customize-reload-preserved", (await jsonFetch(`${baseUrl}/openclaw/office-settings`)).settings.officeLayout.tiles.join("|") === customizedLayoutSignature, await kit());
  const qaObject = { id: "qa-user-object", identifier: "qa-user-object", meshType: "plant", position: [1, 0, 1], rotation: [0, 0, 0], scale: [1, 1, 1], metadata: { qa: true } };
  const customizedObjects = (await jsonFetch(`${baseUrl}/openclaw/office-objects`)).objects;
  await jsonFetch(`${baseUrl}/openclaw/office-objects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ objects: [...customizedObjects, qaObject] }) });
  // The object endpoint is intentionally independent of React state. Reload so the
  // reset action materializes from the same persisted inventory the user sees.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.persisted?.status === "customized", null, { timeout: 30_000 });
  await page.waitForFunction(async (objectId) => {
    const response = await fetch("/openclaw/office-objects");
    const payload = await response.json();
    return payload.objects?.some((object) => object.id === objectId);
  }, qaObject.id, { timeout: 30_000 });
  await qa("runCommand", "builder-mode");
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.builderMode === true);
  const resetButton = page.locator("button").filter({ hasText: /Reset kit|Replace edits|Equip/ }).last();
  await resetButton.click();
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.uiStatus === "confirm");
  await resetButton.click();
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.persisted?.status === "equipped", null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.uiStatus === "idle", null, { timeout: 30_000 });
  record("reset-preserves-user-object", (await jsonFetch(`${baseUrl}/openclaw/office-objects`)).objects.some((object) => object.id === qaObject.id), await kit());
  await page.waitForTimeout(500);
  await qa("runCommand", "builder-mode");
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getOfficeKitState?.()?.builderMode === false);
  record("builder-close", (await kit()).builderMode === false);

  const capacity = await kit();
  const capacityFixture = { projectCount: 9, capacity: capacity.capacity, seatedProjectCount: Math.min(9, capacity.capacity), overflowProjectCount: Math.max(0, 9 - capacity.capacity) };
  record("capacity-overflow", capacityFixture.seatedProjectCount === 7 && capacityFixture.overflowProjectCount === 2 && capacity.projectClusterCount <= capacity.capacity, { live: capacity, nineProjectFixture: capacityFixture, unitProof: "office-data-provider.test.ts" });

  const initialCamera = await camera();
  await page.mouse.move(800, 500);
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(250);
  const zoomed = await camera();
  record("wheel-zoom", zoomed.zoom !== initialCamera.zoom, { initialCamera, zoomed });
  const beforePan = await camera();
  await page.mouse.move(800, 500);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(900, 560, { steps: 8 });
  await page.mouse.up({ button: "middle" });
  await page.waitForTimeout(250);
  const afterPan = await camera();
  record("pan-and-rotation-lock", stable(afterPan.target) !== stable(beforePan.target) && afterPan.controls.enableRotate === false && afterPan.controls.enablePan === true && afterPan.controls.enableZoom === true, { beforePan, afterPan });

  for (const [name, target] of [["center", [0, 0, 0]], ["perimeter", [12, 0, 9]]]) {
    const previousTiming = await qa("getStoryCameraTiming");
    const previousInvokedAt = previousTiming?.invokedAt ?? null;
    const invoked = await qa("runStoryCameraFixture", target);
    record(`story-${name}-invoked`, invoked === true);
    await page.waitForFunction((priorInvokedAt) => {
      const timing = window.__FARPLANE_QA__?.getStoryCameraTiming?.();
      return Boolean(timing?.settledAt && timing.invokedAt !== priorInvokedAt);
    }, previousInvokedAt, { timeout: 5_000 });
    await page.waitForFunction(() => window.__FARPLANE_QA__?.getCameraState?.()?.projection === "PerspectiveCamera");
    await page.waitForTimeout(100);
    const timing = await qa("getStoryCameraTiming");
    const storyCamera = await camera();
    record(`story-${name}-timing`, timing.invokedAt !== previousInvokedAt && timing.targetReadyDurationMs <= 300 && timing.settleDurationMs <= 600 && timing.totalDurationMs <= 1200 && storyCamera.projection === "PerspectiveCamera", { ...timing, camera: storyCamera });
    await shot(`04-story-${name}-close-up`);
  }
  await qa("runStoryCameraFixture", null);
  await page.waitForFunction(() => window.__FARPLANE_QA__?.getCameraState?.()?.projection === "OrthographicCamera");

  record("lineage-created-seed", await qa("seedLineageEvent", { id: "qa-created", source: "missing-parent", target: "qa-created-child", kind: "created", eventAt: Date.now() }) === true);
  record("lineage-forked-seed", await qa("seedLineageEvent", { id: "qa-forked", source: "missing-parent", target: "qa-forked-child", kind: "forked", eventAt: Date.now() }) === true);
  await page.waitForFunction(() => {
    const ids = window.__FARPLANE_QA__?.getThreadEffects?.().map((effect) => effect.id) ?? [];
    return ids.includes("qa-created") && ids.includes("qa-forked");
  });
  await shot("05-lineage-created-forked");
  await page.waitForTimeout(2_500);
  const remainingEffects = await qa("getThreadEffects");
  record("lineage-expiry", !remainingEffects.some((effect) => effect.id === "qa-created" || effect.id === "qa-forked"), remainingEffects);

  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate((mode) => document.documentElement.classList.toggle("dark", mode === "dark"), theme);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await shot(`06-theme-${theme}`);
  }
  const themeCamera = await camera();
  record("light-dark-theme", themeCamera.projection === "OrthographicCamera" && Boolean((await kit()).semanticObjectSignature), { modes: ["light", "dark"], projection: themeCamera.projection, semanticObjectSignature: (await kit()).semanticObjectSignature });

  const conflictResponse = await fetch(`${baseUrl}/farplane/office-kit/state`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: 999999, expectedObjectStateToken: "wrong", settings: equippedSettings, objects: equippedObjects }) });
  record("persistence-conflict-fails-closed", conflictResponse.status === 409, await conflictResponse.json());
  const quality = await qa("getOfficeQualityReport");
  record("scale-and-overlap-report", quality.employeeToDeskHeightRatio >= 1.8 && quality.employeeToDeskHeightRatio <= 2.4 && quality.employeeHitCapsuleWidth >= 0.45 && quality.leafIntersectionCount === 0 && quality.wallIntersectionCount === 0 && quality.minimumCirculationClearance >= 0.65 && quality.activityRoomCount === 13 && quality.missingActivityRoomKinds.length === 0 && quality.duplicateActivityRoomKinds.length === 0, quality);
  record("browser-console-clean", consoleErrors.length === 0, { errors: consoleErrors });
} catch (error) {
  failure = error;
  manifest.error = error instanceof Error ? error.stack : String(error);
} finally {
  try {
    await jsonFetch(`${baseUrl}/openclaw/office-objects`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ objects: originalObjects }) });
    await jsonFetch(`${baseUrl}/openclaw/office-settings`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: originalSettings }) });
    await writeFile(path.join(outDir, "sidecars-restored.json"), `${JSON.stringify({ settings: originalSettings, objects: originalObjects }, null, 2)}\n`);
    manifest.artifacts.push(path.join(outDir, "sidecars-restored.json"));
  } catch (restoreError) {
    failure ??= restoreError;
    manifest.restoreError = String(restoreError);
  }
  await browser?.close();
  manifest.finishedAt = new Date().toISOString();
  manifest.passed = failure == null && manifest.rows.every((row) => row.pass);
  await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

if (failure) throw failure;
