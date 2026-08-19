import { expect, it } from "vitest";
import { terminalQueueDisposition } from "./queueModel";

it("dedupes ready while retrying failed and needs-review terminal jobs", () => {
  expect(terminalQueueDisposition("ready", false)).toBe("reuse_ready");
  expect(terminalQueueDisposition("ready", true)).toBe("create");
  expect(terminalQueueDisposition("failed", false)).toBe("create");
  expect(terminalQueueDisposition("needs_review", false)).toBe("create");
});
