// YouTube metadata + transcript fetchers.
//
// Uses public oEmbed for metadata (no API key required for basic fields) and
// scrapes the timedtext endpoint for transcripts. If YOUTUBE_API_KEY is set,
// we upgrade to the Data API v3 for richer description text.

export interface YouTubeMeta {
  videoId: string;
  title: string;
  description: string;
  author: string | null;
  thumbnail: string | null;
}

export interface TranscriptSegment {
  start: number; // seconds
  duration: number;
  text: string;
}

const YT_DOMAINS = new Set(['youtube.com', 'm.youtube.com', 'www.youtube.com', 'youtu.be']);

export function normalizeYouTubeUrl(url: string): string {
  const id = extractVideoId(url);
  if (!id) throw new Error(`not a YouTube URL: ${url}`);
  return `https://www.youtube.com/watch?v=${id}`;
}

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!YT_DOMAINS.has(u.hostname)) return null;
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = u.pathname.match(/^\/(?:shorts|embed|v)\/([^/]+)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function fetchYouTubeMetadata(canonicalUrl: string): Promise<YouTubeMeta> {
  const videoId = extractVideoId(canonicalUrl);
  if (!videoId) throw new Error('invalid YouTube URL');

  // Prefer YouTube Data API if available — gives full description.
  const ytKey = Deno.env.get('YOUTUBE_API_KEY');
  if (ytKey) {
    const apiUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    apiUrl.searchParams.set('id', videoId);
    apiUrl.searchParams.set('part', 'snippet');
    apiUrl.searchParams.set('key', ytKey);

    const res = await fetch(apiUrl.toString());
    if (res.ok) {
      const data = await res.json();
      const item = data.items?.[0];
      if (item) {
        return {
          videoId,
          title: item.snippet.title ?? '',
          description: item.snippet.description ?? '',
          author: item.snippet.channelTitle ?? null,
          thumbnail:
            item.snippet.thumbnails?.maxres?.url ??
            item.snippet.thumbnails?.high?.url ??
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        };
      }
    }
  }

  // Fallback: oEmbed (no key, title + author only — no description)
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
  const res = await fetch(oembedUrl);
  if (!res.ok) throw new Error(`oEmbed failed: ${res.status}`);
  const data = await res.json();
  return {
    videoId,
    title: data.title ?? '',
    description: '', // oEmbed doesn't include description
    author: data.author_name ?? null,
    thumbnail: data.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

/**
 * Fetch transcript. Tries ko → ja → auto-generated.
 * Returns concatenated text with timestamps in [hh:mm:ss] format prepended
 * to each segment for LLM context.
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<string> {
  const langPriorities = ['ko', 'ja', 'en'];

  for (const lang of langPriorities) {
    const segments = await tryFetchTranscript(videoId, lang, false);
    if (segments.length > 0) return formatTranscript(segments);
  }

  // Last resort: auto-generated
  for (const lang of langPriorities) {
    const segments = await tryFetchTranscript(videoId, lang, true);
    if (segments.length > 0) return formatTranscript(segments);
  }

  // No transcript available — return empty; LLM will rely on description only.
  return '';
}

async function tryFetchTranscript(
  videoId: string,
  lang: string,
  asr: boolean,
): Promise<TranscriptSegment[]> {
  const url = new URL('https://www.youtube.com/api/timedtext');
  url.searchParams.set('v', videoId);
  url.searchParams.set('lang', lang);
  url.searchParams.set('fmt', 'json3');
  if (asr) url.searchParams.set('kind', 'asr');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.events) return [];

    const segments: TranscriptSegment[] = [];
    for (const ev of data.events) {
      if (!ev.segs) continue;
      const text = ev.segs.map((s: { utf8?: string }) => s.utf8 ?? '').join('').trim();
      if (!text) continue;
      segments.push({
        start: Math.floor((ev.tStartMs ?? 0) / 1000),
        duration: Math.floor((ev.dDurationMs ?? 0) / 1000),
        text,
      });
    }
    return segments;
  } catch {
    return [];
  }
}

function formatTranscript(segments: TranscriptSegment[]): string {
  // Group every ~30s into a chunk to reduce token count without losing timestamps.
  const chunks: { start: number; text: string }[] = [];
  let curStart: number | null = null;
  let curText: string[] = [];
  for (const seg of segments) {
    if (curStart === null || seg.start - curStart > 30) {
      if (curText.length > 0 && curStart !== null) {
        chunks.push({ start: curStart, text: curText.join(' ') });
      }
      curStart = seg.start;
      curText = [seg.text];
    } else {
      curText.push(seg.text);
    }
  }
  if (curStart !== null && curText.length > 0) {
    chunks.push({ start: curStart, text: curText.join(' ') });
  }

  return chunks
    .map((c) => {
      const mm = Math.floor(c.start / 60).toString().padStart(2, '0');
      const ss = (c.start % 60).toString().padStart(2, '0');
      return `[${mm}:${ss}] ${c.text}`;
    })
    .join('\n');
}
