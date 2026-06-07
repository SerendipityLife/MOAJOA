import { z } from 'zod';
import { ExtractionStatus, SourceKind } from '../constants';

export const LinkSchema = z.object({
  id: z.string().uuid(),
  board_id: z.string().uuid(),
  added_by: z.string().uuid(),
  source_kind: z.enum(SourceKind),
  /** Canonical URL. For YouTube, normalized to https://www.youtube.com/watch?v=... */
  url: z.string().url(),
  /** Original URL as pasted by user (may differ from canonical). */
  original_url: z.string().url(),
  title: z.string().max(300).nullable(),
  thumbnail_url: z.string().url().nullable(),
  author_name: z.string().max(100).nullable(),
  /** 2~3문장 한국어 영상 TL;DR (Phase 8 EXTRACT-13). null = legacy/없음. */
  summary_ko: z.string().max(800).nullable(),
  /** youtube video id, instagram shortcode, etc — for de-duplication. */
  external_id: z.string().max(100).nullable(),
  extraction_status: z.enum(ExtractionStatus),
  extraction_error: z.string().nullable(),
  /** Confidence 0-1 from LLM extraction; null if not extracted yet. */
  extraction_confidence: z.number().min(0).max(1).nullable(),
  extracted_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export type Link = z.infer<typeof LinkSchema>;

/**
 * Input for adding a link to a board.
 * Backend normalizes URL, detects source_kind, fetches metadata async.
 */
export const LinkAddSchema = z.object({
  board_id: z.string().uuid(),
  url: z.string().url(),
});

export type LinkAdd = z.infer<typeof LinkAddSchema>;

/**
 * URL → source kind detection. Used both client- and server-side for early UI feedback.
 */
export function detectSourceKind(url: string): z.infer<typeof LinkSchema>['source_kind'] | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
      return 'youtube';
    }
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
      return 'instagram';
    }
    // Heuristic: known blog platforms. Manual sources skip detection.
    if (
      host.endsWith('.tistory.com') ||
      host.endsWith('.blog.naver.com') ||
      host === 'blog.naver.com' ||
      host.endsWith('.medium.com') ||
      host === 'medium.com' ||
      host.endsWith('.brunch.co.kr') ||
      host === 'brunch.co.kr' ||
      host.endsWith('.velog.io') ||
      host === 'velog.io'
    ) {
      return 'blog';
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract YouTube video ID from any youtube URL variant.
 * Returns null if not a valid YouTube URL.
 */
export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1) || null;
    }
    if (u.hostname.endsWith('youtube.com')) {
      // /watch?v=ID
      const v = u.searchParams.get('v');
      if (v) return v;
      // /shorts/ID, /embed/ID, /v/ID
      const match = u.pathname.match(/^\/(?:shorts|embed|v)\/([^/]+)/);
      if (match) return match[1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
