import { defineSchema } from "convex/server";
import { agentActivityTables } from "./modules/agentActivity/schema";
import { hookTelemetryTables } from "./modules/hookTelemetry/schema";
import { projectArtefactTables } from "./modules/projectArtefacts/schema";
import { resourceBankTables } from "./modules/resourceBank/schema";

export default defineSchema({
  ...agentActivityTables,
  ...hookTelemetryTables,
  ...projectArtefactTables,
  ...resourceBankTables,
});
