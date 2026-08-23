import { describe, expect, it } from "vitest";
import { resolveSystemFacility, SYSTEM_FACILITY_REGISTRY } from "./system-facility-registry";

describe("system facility registry", () => {
  it("keeps integration facilities non-chat, system-addressed Office objects", () => {
    expect(SYSTEM_FACILITY_REGISTRY).toHaveLength(1);
    expect(resolveSystemFacility("x-publishing")).toMatchObject({
      departmentId: "marketing",
      roomId: "production",
      skillId: "x-account",
      system: "x",
    });
    expect(resolveSystemFacility("unknown")).toBeUndefined();
  });
});
