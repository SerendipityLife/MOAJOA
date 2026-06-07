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

/** Decode the response body, honoring an EUC-KR/MS949 charset if declared. */
async function decodeBody(res: Response): Promise<string> {
  const charset = (res.headers.get('content-type') ?? '')
    .toLowerCase()
    .match(/charset=([^\s;]+)/)?.[1];
  if (charset === 'euc-kr' || charset === 'ms949' || charset === 'cp949') {
    // Deno's TextDecoder supports euc-kr (covers ms949/cp949 superset).
    return new TextDecoder('euc-kr').decode(await res.arrayBuffer());
  }
  return await res.text();
}

/**
 * Fetch a blog page and return a normalized, Zod-validated SourceContent.
 *
 * Pipeline: SSRF guard → (naver rewrite) → fetch (browser UA + ko-KR, 10s cap)
 * → EUC-KR-aware decode → deno-dom DOMParser → read og: meta BEFORE Readability
 * (parse() mutates the DOM) → naver selector path (se-main-container →
 * postViewArea) with Readability fallback → throw on empty body.
 */
export async function fetchBlogContent(
  url: string,
  fetchImpl: FetchImpl = fetch,
): Promise<SourceContent> {
  // 1. SSRF guard FIRST (threat T-09-01) — before any fetch.
  const parsed = assertFetchableUrl(url);

  // 2. Naver iframe special-case: rewrite to the server-rendered PostView URL.
  const naverTarget = toNaverPostView(parsed.toString());
  const target = naverTarget ?? parsed.toString();
  const isNaver = naverTarget !== null;

  // 3. Fetch with a browser-like UA + ko-KR (Pitfall 2) and a 10s cap (T-09-04).
  const res = await fetchImpl(target, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; MoajoaBot/1.0)',
      'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`blog fetch ${res.status}`);

  // 4. EUC-KR-aware decode (Pitfall 3).
  const html = await decodeBody(res);

  // 5. Parse to a DOM Document (WASM backend — hosted-runtime compatible).
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc) throw new Error('blog: HTML 파싱에 실패했어요');

  // 6. Read meta BEFORE Readability (parse() mutates/strips the DOM).
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? null;
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null;
  const metaAuthor =
    doc.querySelector('meta[property="article:author"]')?.getAttribute('content') ??
    doc.querySelector('meta[name="author"]')?.getAttribute('content') ??
    null;
  const docTitle = doc.querySelector('title')?.textContent?.trim() || null;
  const title = ogTitle ?? docTitle ?? '';
  const thumbnail = ogImage;

  // 7. Naver selector path: se-main-container (SE3) → postViewArea (legacy).
  let bodyText = '';
  if (isNaver) {
    const naverBody =
      doc.querySelector('div.se-main-container')?.textContent ??
      doc.querySelector('div#postViewArea')?.textContent ??
      null;
    bodyText = (naverBody ?? '').trim();
  }

  // 8. Readability fallback (static blogs + naver-empty). deno-dom's Document
  //    is structurally compatible at runtime but its types differ from the
  //    DOM-lib Document Readability expects — cast at the boundary (Pitfall 6).
  if (!bodyText) {
    // deno-lint-ignore no-explicit-any
    const article = new Readability(doc as any).parse();
    bodyText = (article?.textContent ?? '').trim();
  }

  // 9. Explicit failure → router catch → extraction_status='failed'.
  if (!bodyText) throw new Error('blog: 본문을 추출하지 못했어요');

  // 10. Zod-validate the normalized output (CONTEXT constraint).
  return SourceContentSchema.parse({
    title,
    bodyText,
    thumbnail,
    author: metaAuthor,
    externalId: null,
  }) as SourceContent;
}
