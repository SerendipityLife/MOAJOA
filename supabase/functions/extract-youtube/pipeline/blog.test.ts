import { assertEquals, assertRejects, assertStringIncludes } from 'jsr:@std/assert';
import { fetchBlogContent, toNaverPostView } from './blog.ts';
import type { FetchImpl } from './source.ts';

// A mock fetch seam: returns a real Response built from a fixture so that
// res.text()/res.arrayBuffer()/res.headers all behave like the real thing —
// no live network. `bytes` lets a test supply non-UTF-8 (EUC-KR) bytes.
function mockFetch(
  fixture: { html?: string; bytes?: Uint8Array; status?: number; contentType?: string },
): FetchImpl & { called: boolean } {
  const fn = ((_input: string | URL | Request, _init?: RequestInit) => {
    fn.called = true;
    // Uint8Array is a valid BodyInit at runtime; the lib type omits it.
    const body = (fixture.bytes ?? fixture.html ?? '') as BodyInit;
    return Promise.resolve(
      new Response(body, {
        status: fixture.status ?? 200,
        headers: { 'content-type': fixture.contentType ?? 'text/html; charset=utf-8' },
      }),
    );
  }) as FetchImpl & { called: boolean };
  fn.called = false;
  return fn;
}

const TISTORY_HTML = `<!doctype html><html><head>
  <title>티스토리 글</title>
  <meta property="og:title" content="성수동 카페 투어">
  <meta property="og:image" content="https://img.example/cover.jpg">
  <meta name="author" content="홍길동">
</head><body><article>
  <h1>성수동 카페 투어</h1>
  <p>오늘은 성수동의 분위기 좋은 카페 세 곳을 다녀왔어요. 첫 번째는 어니언 성수, 두 번째는 대림창고, 세 번째는 카페 할아버지공장입니다. 각 카페마다 시그니처 메뉴가 달라서 비교하는 재미가 있었어요.</p>
</article></body></html>`;

const NAVER_SE3_HTML = `<!doctype html><html><head><title>네이버 블로그</title>
  <meta property="og:title" content="제주 맛집 정리">
</head><body>
  <div class="se-main-container"><p>제주 흑돼지 맛집으로는 돈사돈과 숙성도가 유명합니다. 고기국수는 자매국수가 줄을 길게 서는 곳이에요. 카페는 봄날과 원앤온리를 추천합니다.</p></div>
</body></html>`;

const NAVER_LEGACY_HTML = `<!doctype html><html><head><title>네이버 구버전</title></head><body>
  <div id="postViewArea"><p>부산 여행 코스로는 감천문화마을, 광안리 해수욕장, 해동용궁사를 추천합니다. 저녁은 자갈치시장에서 회를 드세요.</p></div>
</body></html>`;

Deno.test('toNaverPostView — path form /<blogId>/<logNo>', () => {
  assertEquals(
    toNaverPostView('https://blog.naver.com/myid/223456789'),
    'https://blog.naver.com/PostView.naver?blogId=myid&logNo=223456789',
  );
});

Deno.test('toNaverPostView — already query form (blogId/logNo params)', () => {
  assertEquals(
    toNaverPostView('https://blog.naver.com/PostView.naver?blogId=myid&logNo=99'),
    'https://blog.naver.com/PostView.naver?blogId=myid&logNo=99',
  );
});

Deno.test('toNaverPostView — non-naver host returns null', () => {
  assertEquals(toNaverPostView('https://example.tistory.com/1'), null);
});

Deno.test('fetchBlogContent — static blog (Readability + og:title)', async () => {
  const mock = mockFetch({ html: TISTORY_HTML });
  const content = await fetchBlogContent('https://example.tistory.com/1', mock);
  assertEquals(content.title, '성수동 카페 투어');
  assertEquals(content.thumbnail, 'https://img.example/cover.jpg');
  assertEquals(content.author, '홍길동');
  assertStringIncludes(content.bodyText, '어니언 성수');
});

Deno.test('fetchBlogContent — naver SE3 (se-main-container) after rewrite', async () => {
  const mock = mockFetch({ html: NAVER_SE3_HTML });
  const content = await fetchBlogContent('https://blog.naver.com/myid/223456789', mock);
  assertStringIncludes(content.bodyText, '제주 흑돼지');
  assertStringIncludes(content.bodyText, '돈사돈');
});

Deno.test('fetchBlogContent — naver legacy fallback (postViewArea)', async () => {
  const mock = mockFetch({ html: NAVER_LEGACY_HTML });
  const content = await fetchBlogContent('https://blog.naver.com/myid/100', mock);
  assertStringIncludes(content.bodyText, '감천문화마을');
  assertStringIncludes(content.bodyText, '자갈치시장');
});

Deno.test('fetchBlogContent — EUC-KR response decodes without mojibake', async () => {
  // "한글" in EUC-KR = C7 D1 B1 DB; ASCII tags are byte-identical in EUC-KR.
  const enc = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
  const han = [0xc7, 0xd1, 0xb1, 0xdb]; // 한글
  const bytes = new Uint8Array([
    ...enc('<html><head><title>'),
    ...han,
    ...enc('</title></head><body><article><p>'),
    ...han,
    ...enc(' is a sufficiently long article paragraph body for Readability to score and extract the main content here.</p></article></body></html>'),
  ]);
  const mock = mockFetch({ bytes, contentType: 'text/html; charset=euc-kr' });
  const content = await fetchBlogContent('https://legacy.tistory.com/1', mock);
  assertStringIncludes(content.bodyText, '한글');
  assertEquals(content.bodyText.includes('�'), false); // no replacement char
});

Deno.test('fetchBlogContent — SSRF guard rejects before fetch', async () => {
  const mock = mockFetch({ html: TISTORY_HTML });
  await assertRejects(() => fetchBlogContent('http://169.254.169.254/x', mock));
  assertEquals(mock.called, false); // guard fired before any fetch
});
