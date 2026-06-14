import { defineSchema } from "convex/server";
import { agentActivityTables } from "./modules/agentActivity/schema";
import { projectArtefactTables } from "./modules/projectArtefacts/schema";
import { runtimeTelemetryTables } from "./modules/runtimeTelemetry/schema";
import { skillInvocationTables } from "./modules/skillInvocations/schema";
import { teamBoardTables } from "./modules/teamBoard/schema";

export default defineSchema({
  ...agentActivityTables,
  ...runtimeTelemetryTables,
  ...skillInvocationTables,
  ...teamBoardTables,
  ...projectArtefactTables,
});
