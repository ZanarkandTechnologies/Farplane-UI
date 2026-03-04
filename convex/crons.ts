import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "prune stale agent events",
  { hours: 1 },
  internal.events.clearStaleEvents,
  { olderThanMs: 24 * 60 * 60 * 1000, limit: 500 },
);

export default crons;
