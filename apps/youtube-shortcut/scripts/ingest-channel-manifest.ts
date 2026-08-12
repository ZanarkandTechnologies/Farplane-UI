import { fileURLToPath } from "node:url";
import type { ManifestRunnerOptions } from "./ingest-channel-manifest-contract.js";
import { runManifestIngest as runWithDefaults } from "./ingest-channel-manifest-runner.js";

const DEFAULT_MANIFEST_PATH = fileURLToPath(
  new URL("../../../tickets/TASK-0080/artifacts/2026-channel-manifest.json", import.meta.url),
);
const DEFAULT_REPORT_PATH = fileURLToPath(
  new URL("../../../tickets/TASK-0080/artifacts/qa/manifest-report.json", import.meta.url),
);

export type {
  ChannelManifest,
  ManifestIngestReport,
  ManifestRecord,
  ManifestRunnerOptions,
} from "./ingest-channel-manifest-contract.js";
export { loadChannelManifest } from "./ingest-channel-manifest-transport.js";

/** Runs the fixed channel manifest using the app's ordinary YouTube bridge route. */
export function runManifestIngest(
  options: ManifestRunnerOptions = {},
) {
  return runWithDefaults({
    ...options,
    defaultManifestPath: DEFAULT_MANIFEST_PATH,
    defaultReportPath: DEFAULT_REPORT_PATH,
  });
}

function parseOptions(argv: string[]): ManifestRunnerOptions & { help?: boolean } {
  const options: ManifestRunnerOptions & { help?: boolean } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    const [name, inlineValue] = argument.split("=", 2);
    const value = inlineValue ?? argv[++index];
    if (!value) throw new Error(`Missing value for ${name}`);
    if (name === "--manifest") options.manifestPath = value;
    else if (name === "--report") options.reportPath = value;
    else if (name === "--endpoint") options.endpoint = value;
    else if (name === "--project-id") options.projectId = value;
    else if (name === "--max-sources") options.maxSources = Number(value);
    else if (name === "--concurrency") options.concurrency = Number(value);
    else throw new Error(`Unknown option: ${name}`);
  }
  return options;
}

if (process.argv[1]?.endsWith("ingest-channel-manifest.ts")) {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: tsx scripts/ingest-channel-manifest.ts [--manifest PATH] [--report PATH] [--endpoint URL] [--project-id ID] [--max-sources N] [--concurrency 1-5]",
    );
  } else {
    runManifestIngest(options)
      .then((report) => {
        console.log(JSON.stringify(report, null, 2));
        process.exit(report.summary.blocked > 0 ? 2 : 0);
      })
      .catch((error) => {
        console.error(`Manifest ingestion blocked: ${(error as Error).message}`);
        process.exit(1);
      });
  }
}
