import assert from "node:assert/strict";
import { test } from "node:test";
import { rankPoints, timestampSeconds } from "./key-point-novelty.js";

test("ranks new, extends, untagged, then restated and strips the tag", () => {
  const ranked = rankPoints([
    { finding: "[RESTATED] Old idea", timestamp: "3:08" },
    { finding: "Plain point" },
    { finding: "[EXTENDS] Builds on a claim", timestamp: "1:02" },
    { finding: "[NEW] Fresh idea", timestamp: "2:04" },
  ]);
  assert.deepEqual(
    ranked.map((point) => [point.novelty, point.finding]),
    [["new", "Fresh idea"], ["extends", "Builds on a claim"], ["untagged", "Plain point"], ["restated", "Old idea"]],
  );
});

test("turns timestamps into seconds", () => {
  assert.equal(timestampSeconds("2:04"), 124);
  assert.equal(timestampSeconds("1:02:03"), 3723);
  assert.equal(timestampSeconds("soon"), null);
});
