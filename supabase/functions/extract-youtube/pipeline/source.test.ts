import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { assertFetchableUrl, SourceContentSchema } from './source.ts';

Deno.test('SourceContentSchema accepts a valid object', () => {
  const parsed = SourceContentSchema.parse({
    title: 'T',
    bodyText: 'body',
    thumbnail: null,
    author: null,
  });
  assertEquals(parsed.bodyText, 'body');
});

Deno.test('SourceContentSchema rejects missing bodyText', () => {
  assertThrows(() =>
    SourceContentSchema.parse({ title: 'T', thumbnail: null, author: null })
  );
});

Deno.test('assertFetchableUrl accepts a normal https blog URL', () => {
  const u = assertFetchableUrl('https://example.tistory.com/1');
  assertEquals(u.hostname, 'example.tistory.com');
});

Deno.test('assertFetchableUrl rejects file:// scheme', () => {
  assertThrows(() => assertFetchableUrl('file:///etc/passwd'));
});

Deno.test('assertFetchableUrl rejects localhost', () => {
  assertThrows(() => assertFetchableUrl('http://localhost/x'));
});

Deno.test('assertFetchableUrl rejects 127.0.0.1 loopback', () => {
  assertThrows(() => assertFetchableUrl('http://127.0.0.1/x'));
});

Deno.test('assertFetchableUrl rejects 169.254.169.254 metadata', () => {
  assertThrows(() => assertFetchableUrl('http://169.254.169.254/latest/meta-data'));
});

Deno.test('assertFetchableUrl rejects 10.0.0.0/8 private', () => {
  assertThrows(() => assertFetchableUrl('http://10.0.0.5/x'));
});

Deno.test('assertFetchableUrl rejects 192.168.0.0/16 private', () => {
  assertThrows(() => assertFetchableUrl('http://192.168.1.1/x'));
});

Deno.test('assertFetchableUrl rejects ::1 IPv6 loopback', () => {
  assertThrows(() => assertFetchableUrl('http://[::1]/x'));
});

Deno.test('assertFetchableUrl rejects malformed URL', () => {
  assertThrows(() => assertFetchableUrl('not a url'));
});

// --- numeric/shorthand IPv4 + mapped-IPv6 bypass hardening (2026-06-12) ------

Deno.test('assertFetchableUrl rejects decimal-integer loopback (2130706433)', () => {
  assertThrows(() => assertFetchableUrl('http://2130706433/x'));
});

Deno.test('assertFetchableUrl rejects hex loopback (0x7f000001)', () => {
  assertThrows(() => assertFetchableUrl('http://0x7f000001/x'));
});

Deno.test('assertFetchableUrl rejects octal loopback (017700000001)', () => {
  assertThrows(() => assertFetchableUrl('http://017700000001/x'));
});

Deno.test('assertFetchableUrl rejects shorthand 127.1', () => {
  assertThrows(() => assertFetchableUrl('http://127.1/x'));
});

Deno.test('assertFetchableUrl rejects IPv4-mapped IPv6 loopback (::ffff:127.0.0.1)', () => {
  assertThrows(() => assertFetchableUrl('http://[::ffff:127.0.0.1]/x'));
});

Deno.test('assertFetchableUrl rejects 0.0.0.0', () => {
  assertThrows(() => assertFetchableUrl('http://0.0.0.0/x'));
});

Deno.test('assertFetchableUrl still accepts a public decimal-looking domain label', () => {
  // 123456789012345678901.com is a hostname, not a numeric IP — must pass.
  const u = assertFetchableUrl('https://12345678901234567890.com/x');
  assertEquals(u.hostname, '12345678901234567890.com');
});

Deno.test('assertFetchableUrl still accepts a public IPv4 literal', () => {
  const u = assertFetchableUrl('http://93.184.216.34/x');
  assertEquals(u.hostname, '93.184.216.34');
});
