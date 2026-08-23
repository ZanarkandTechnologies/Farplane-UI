import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const backgroundPath = fileURLToPath(
  new URL("../build/chrome-mv3-prod/static/background/index.js", import.meta.url),
);
const background = await readFile(backgroundPath, "utf8");

if (!background.includes("chrome.runtime.onMessage.addListener")) {
  throw new Error("Extension build is missing the background message listener.");
}

// The worker must stay a startup-safe relay. Keep analysis parsing and cache
// validation out of this startup path so a dependency failure cannot make the
// popup look offline.
if (/analysis-contract|parseAnalysis|zod/i.test(background)) {
  throw new Error("Background worker pulled in analysis validation dependencies.");
}

if (Buffer.byteLength(background) > 8_000) {
  throw new Error("Background worker exceeded the 8 KB startup-safety budget.");
}
