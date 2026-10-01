import { defineTable } from "convex/server";
import { metricReadingFields } from "./validators";

export const metricsTables = {
  metricReadings: defineTable(metricReadingFields)
    // Latest per project + metric (desc first), history (range on at), and the skip-scan in `latest`.
    .index("by_project_metric_at", ["project", "metric", "at"])
    .index("by_project_at", ["project", "at"]),
};
