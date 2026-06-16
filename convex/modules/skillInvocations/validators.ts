import { v } from "convex/values";

export const skillInvocationDashboardArgsValidator = {
  rangeDays: v.optional(v.number()),
  limit: v.optional(v.number()),
};
