import { defineSchema } from "convex/server";
import { agentActivityTables } from "./modules/agentActivity/schema";
import { contentTables } from "./modules/content/schema";
import { experimentsTables } from "./modules/experiments/schema";
import { hookTelemetryTables } from "./modules/hookTelemetry/schema";
import { metricsTables } from "./modules/metrics/schema";
import { projectArtefactTables } from "./modules/projectArtefacts/schema";
import { resourceBankTables } from "./modules/resourceBank/schema";
import { telemetryTables } from "./modules/telemetry/schema";
import { videoIntelligenceTables } from "./modules/videoIntelligence/schema";

export default defineSchema({
  ...agentActivityTables,
  ...contentTables,
  ...experimentsTables,
  ...hookTelemetryTables,
  ...metricsTables,
  ...projectArtefactTables,
  ...resourceBankTables,
  ...telemetryTables,
  ...videoIntelligenceTables,
});
