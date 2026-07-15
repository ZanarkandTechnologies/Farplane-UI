import { describe, expect, it } from "vitest";
import {
  COMMAND_COMMONS_VISUAL_DEPTH,
  COMMAND_COMMONS_VISUAL_WIDTH,
  commandCommonsFrameFitsVisualFootprint,
} from "./command-commons-geometry";

describe("command commons rendered geometry", () => {
  it("keeps restored architecture inside the validator-owned visual footprint", () => {
    expect(COMMAND_COMMONS_VISUAL_WIDTH).toBe(11.8);
    expect(COMMAND_COMMONS_VISUAL_DEPTH).toBe(8.4);
    expect(commandCommonsFrameFitsVisualFootprint()).toBe(true);
  });
});
