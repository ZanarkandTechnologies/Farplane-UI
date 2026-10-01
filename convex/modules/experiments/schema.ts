import { defineTable } from "convex/server";
import { abSendFields, abSourceTotalFields, abTestFields } from "./validators";

export const experimentsTables = {
  abTests: defineTable(abTestFields).index("by_project_testId", ["project", "testId"]),
  abSends: defineTable(abSendFields)
    .index("by_project_test_at", ["project", "testId", "at"])
    .index("by_project_test_send", ["project", "testId", "sendId"]),
  abSourceTotals: defineTable(abSourceTotalFields).index("by_project_test_option_at", [
    "project",
    "testId",
    "option",
    "at",
  ]),
};
