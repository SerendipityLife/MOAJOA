// Instagram source adapter — graceful explicit-failure (SRC-02).
//
// There is no reliable no-auth Instagram caption path in 2026: Basic Display API
// reached EOL 2024-12-04, `?__a=1`/GraphQL endpoints are login-walled, and oEmbed
// now requires an app-level access token. The spec'd SRC-02 outcome is therefore a
// deterministic, explicit failure so the link lands in extraction_status='failed'
// with an actionable Korean reason (index.ts catch maps thrown Error → 'failed').
//
// Future supported path (requires a Meta app + "oEmbed Read" feature + an
// INSTAGRAM_OEMBED_TOKEN secret of the form `<APP_ID>|<APP_SECRET>`):
//   GET https://graph.facebook.com/v23.0/instagram_oembed?url=<post>&access_token=<APP_ID|APP_SECRET>
// None of that is provisioned now → graceful fail.

import type { FetchImpl, SourceContent } from './source.ts';

// `_fetchImpl` is accepted for signature parity with blog.ts (Plan 02) so the
// router can call every adapter uniformly. It is unused while IG is graceful-fail.
export async function fetchInstagramContent(
  _url: string,
  _fetchImpl: FetchImpl = fetch,
): Promise<SourceContent> {
  throw new Error(
    'instagram: 자동 추출 미지원 (무인증 캡션 접근 불가). 캡션을 직접 입력하거나 큐레이션 대기열로 처리하세요.',
  );
}
