import { defineSchema } from "convex/server";
import { agentActivityTables } from "./modules/agentActivity/schema";
import { contentTables } from "./modules/content/schema";
import { hookTelemetryTables } from "./modules/hookTelemetry/schema";
import { projectArtefactTables } from "./modules/projectArtefacts/schema";
import { resourceBankTables } from "./modules/resourceBank/schema";
import { videoIntelligenceTables } from "./modules/videoIntelligence/schema";

export default defineSchema({
  ...agentActivityTables,
  ...contentTables,
  ...hookTelemetryTables,
  ...projectArtefactTables,
  ...resourceBankTables,
  ...videoIntelligenceTables,
});
