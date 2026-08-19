import { describe, expect, it } from "vitest";
import { canAdvanceVideoProgress, defaultProgressForJobStatus } from "./progressModel";

describe("video analysis progress", () => {
  it("advances monotonically through only observable stages", () => {
    expect(canAdvanceVideoProgress("queued", "preparing")).toBe(true);
    expect(canAdvanceVideoProgress("preparing", "analyzing")).toBe(true);
    expect(canAdvanceVideoProgress("analyzing", "persistence")).toBe(true);
    expect(canAdvanceVideoProgress("persistence", "complete")).toBe(true);
    expect(canAdvanceVideoProgress("persistence", "preparing")).toBe(false);
    expect(canAdvanceVideoProgress("complete", "failed")).toBe(false);
  });

  it("labels opaque legacy work honestly", () => {
    expect(defaultProgressForJobStatus("analyzing")).toEqual({
      stage: "analyzing",
      message: "Analysis is running; the legacy job did not record a more specific stage.",
    });
  });
});
