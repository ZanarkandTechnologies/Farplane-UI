import { describe, expect, it } from "vitest";
import { OFFICE_HTML_Z, UI_Z } from "./z-index";

describe("Office z-index system", () => {
  it("keeps every Html overlay inside the isolated canvas below HUD chrome", () => {
    for (const [name, [max, min]] of Object.entries(OFFICE_HTML_Z)) {
      expect(max, `${name} max`).toBeGreaterThan(min);
      expect(min, `${name} min`).toBeGreaterThan(UI_Z.sceneCanvas);
      expect(max, `${name} max`).toBeLessThan(UI_Z.sceneHud);
    }
  });

  it("reserves distinct ranges for debug, labels, status, and controls", () => {
    expect(OFFICE_HTML_Z.debug[0]).toBeLessThan(OFFICE_HTML_Z.label[1]);
    expect(OFFICE_HTML_Z.label[0]).toBeLessThan(OFFICE_HTML_Z.status[1]);
    expect(OFFICE_HTML_Z.status[0]).toBeLessThan(OFFICE_HTML_Z.control[1]);
  });
});
