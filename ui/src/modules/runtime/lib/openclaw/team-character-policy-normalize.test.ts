import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_MODEL, normalizeCompanyModel } from "./normalize";

describe("team character policy normalization", () => {
  it("round-trips valid skill transformations and drops invalid sprite references", () => {
    const company = normalizeCompanyModel({
      ...DEFAULT_COMPANY_MODEL,
      projects: [
        {
          id: "proj-demo",
          departmentId: "dept-products",
          name: "Demo",
          characterPolicy: {
            persistent: { renderer: "three-human" },
            ephemeral: { renderer: "three-human" },
            skillTransformations: {
              research: {
                character: { renderer: "sprite-sheet-2d", petId: "mini-chua" },
                enterAnimation: "poof",
              },
              invalid: { character: { renderer: "sprite-sheet-2d" } },
            },
          },
        },
      ],
    });

    expect(company.projects[0]?.characterPolicy?.skillTransformations).toEqual({
      research: {
        character: { renderer: "sprite-sheet-2d", petId: "mini-chua" },
        enterAnimation: "poof",
      },
    });
  });
});
