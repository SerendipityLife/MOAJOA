import { assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { parseMime, stripHtml } from './mail.ts';

// A minimal but real RFC822 MIME string (plaintext body).
const PLAIN_MIME = [
  'From: Klook <noreply@klook.com>',
  'To: abc123token@ledger.moajoa.app',
  'Subject: 예약 확정 — 도쿄 타워 입장권',
  'Date: Wed, 01 Jul 2026 09:12:00 +0900',
  'Content-Type: text/plain; charset=utf-8',
  '',
  '결제 금액: JPY 3,400',
  '카드: 1234로 끝나는 카드',
].join('\r\n');

Deno.test('parseMime — extracts subject/from/text/date from a plaintext MIME', async () => {
  const parsed = await parseMime(PLAIN_MIME);
  assertStringIncludes(parsed.subject ?? '', '예약 확정');
  assertStringIncludes(parsed.from ?? '', 'klook.com');
  assertStringIncludes(parsed.text ?? '', 'JPY 3,400');
  // Date header parsed to an ISO string.
  assertStringIncludes(parsed.date ?? '', '2026-07-01');
});

const HTML_MIME = [
  'From: card@bank.example',
  'To: tok@ledger.moajoa.app',
  'Subject: 해외결제 알림',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<html><body><p>USD 12.50</p><style>.x{color:red}</style></body></html>',
].join('\r\n');

Deno.test('parseMime — HTML-only mail falls back to stripped text', async () => {
  const parsed = await parseMime(HTML_MIME);
  assertStringIncludes(parsed.text ?? '', 'USD 12.50');
  // style block must not leak into the stripped text.
  assertEquals((parsed.text ?? '').includes('color:red'), false);
});

Deno.test('stripHtml — drops tags and style, collapses whitespace', () => {
  const out = stripHtml('<div>a<style>.z{}</style>  b</div>');
  assertEquals(out, 'a b');
});
