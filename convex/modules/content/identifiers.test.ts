/** Tests the intentionally narrow canonical identity contract for external content. */
import { describe, expect, it } from "vitest";
import { canonicalizeContentRef, extractYouTubeVideoId } from "./identifiers";

describe("Content source identifiers", () => {
  it("coalesces only documented YouTube video URL variants", () => {
    const expected = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    for (const input of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
    ]) {
      expect(canonicalizeContentRef(input)).toBe(expected);
    }
  });

  it("does not treat lookalike hosts or unsupported paths as YouTube", () => {
    for (const input of [
      "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ/extra",
    ]) {
      expect(extractYouTubeVideoId(input)).toBeNull();
      expect(canonicalizeContentRef(`  ${input}  `)).toBe(input);
    }
  });
});
