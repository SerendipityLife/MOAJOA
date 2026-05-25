/**
 * YouTube URL helpers for Phase 4 VIEW-05 (pin tap → YouTube new tab).
 *
 * Per RESEARCH §Pattern 7 + CONTEXT D-15.
 * Out of v1 scope: m.youtube.com, youtube.com/shorts.
 */

/**
 * Extract YouTube video_id from various URL formats.
 * Supported: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID.
 * Returns null for non-YouTube or malformed URLs (incl. shorts/, empty string).
 */
export function extractYouTubeVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

/**
 * Build a YouTube watch URL with optional timestamp suffix (per D-15).
 * - Always normalizes to youtube.com/watch?v=ID form (works on both desktop + mobile).
 * - If linkUrl doesn't contain a recognizable video_id, returns null.
 * - If timestampSec is null/0/fractional<1, omits ?t= (Math.floor → 0 → guard).
 */
export function buildYouTubeWatchUrl(
  linkUrl: string,
  timestampSec: number | null,
): string | null {
  const videoId = extractYouTubeVideoId(linkUrl);
  if (!videoId) return null;
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  const floored = timestampSec != null ? Math.floor(timestampSec) : 0;
  return floored > 0 ? `${base}&t=${floored}s` : base;
}
