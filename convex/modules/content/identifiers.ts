/**
 * Content-owned external identity rules.
 * Only the documented YouTube forms coalesce; all other references retain their exact identity.
 */

export const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

export function extractYouTubeVideoId(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be") {
      const parts = url.pathname.split("/").filter(Boolean);
      return parts.length === 1 && isYouTubeVideoId(parts[0]) ? parts[0] : null;
    }
    if (!YOUTUBE_HOSTS.has(host)) return null;
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return isYouTubeVideoId(id) ? id : null;
    }
    const shorts = url.pathname.match(/^\/shorts\/([^/]+)\/?$/)?.[1];
    return isYouTubeVideoId(shorts) ? shorts : null;
  } catch {
    return null;
  }
}

export function canonicalYouTubeUrl(videoId: string): string {
  if (!isYouTubeVideoId(videoId)) throw new Error("invalid_youtube_video_id");
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function canonicalizeContentRef(value: string): string {
  const exact = value.trim().replace(/\s+/g, " ").slice(0, 2_000);
  const videoId = extractYouTubeVideoId(exact);
  return videoId ? canonicalYouTubeUrl(videoId) : exact;
}

function isYouTubeVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && YOUTUBE_VIDEO_ID_PATTERN.test(value);
}
