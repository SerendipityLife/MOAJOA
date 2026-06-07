// Blog source adapter (SRC-01).
//
// fetch → deno-dom WASM DOMParser → @mozilla/readability, with a Naver-blog
// special case (the post lives in an iframe whose `PostView.naver` target is
// itself plain server-rendered HTML). Defends against EUC-KR mojibake and
// routes every fetch through the Plan-01 SSRF guard.

import { Readability } from 'npm:@mozilla/readability@0.6.0';
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.56/deno-dom-wasm.ts';
import {
  assertFetchableUrl,
  type FetchImpl,
  type SourceContent,
  SourceContentSchema,
} from './source.ts';

/**
 * Rewrite a Naver blog URL to its server-rendered `PostView.naver` endpoint.
 * `blog.naver.com/<id>/<no>` and `m.blog.naver.com/...` wrap the post in an
 * iframe; the iframe target is plain HTML fetchable without a browser.
 * Returns null for non-naver hosts (caller fetches the URL as-is).
 */
export function toNaverPostView(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  // endsWith covers both blog.naver.com and m.blog.naver.com.
  if (!u.hostname.endsWith('blog.naver.com')) return null;

  // Query form already present (e.g. PostView.naver?blogId=&logNo=).
  const qsBlogId = u.searchParams.get('blogId');
  const qsLogNo = u.searchParams.get('logNo');
  if (qsBlogId && qsLogNo) {
    return `https://blog.naver.com/PostView.naver?blogId=${qsBlogId}&logNo=${qsLogNo}`;
  }

  // Path form: /<blogId>/<logNo>.
  const m = u.pathname.match(/^\/([^/]+)\/(\d+)/);
  if (!m) return null;
  return `https://blog.naver.com/PostView.naver?blogId=${m[1]}&logNo=${m[2]}`;
}
