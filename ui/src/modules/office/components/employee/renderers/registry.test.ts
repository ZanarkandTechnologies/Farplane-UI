import { describe, expect, it } from "vitest";

import { resolveEmployeeCharacterRenderer } from "./registry";

describe("employee character renderer registry", () => {
  it("falls back to the existing Three.js human renderer by default", () => {
    expect(resolveEmployeeCharacterRenderer({ employeeId: "employee-main" })).toEqual({
      id: "three-human",
      config: { id: "three-human" },
    });
  });

  it("accepts a hatch-pet backed sprite renderer when a Codex pet source is configured", () => {
    expect(
      resolveEmployeeCharacterRenderer({
        employeeId: "employee-main",
        characterRenderer: {
          id: "sprite-sheet-2d",
          source: { type: "codex-pet", petId: "mini-kenji" },
        },
      }),
    ).toEqual({
      id: "sprite-sheet-2d",
      config: {
        id: "sprite-sheet-2d",
        source: { type: "codex-pet", petId: "mini-kenji" },
      },
    });
  });

  it("does not select sprite rendering without a source", () => {
    expect(
      resolveEmployeeCharacterRenderer({
        employeeId: "employee-main",
        characterRenderer: { id: "sprite-sheet-2d" },
      }),
    ).toEqual({
      id: "three-human",
      config: { id: "three-human" },
    });
  });
});
