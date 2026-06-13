import { assertEquals } from 'jsr:@std/assert';
import { extractMapLinkEntries, normalizeName, parsePlaceFromMapsUrl } from './maplinks.ts';

// Real description excerpt from l8PRad4T-IY (삿포로 맛집 모음).
const DESC = `삿포로에서 이치란은 참아주세요!!
00:00 인트로
00:16 라멘

- 라멘요코초 쿠니미츠 : https://maps.app.goo.gl/5Ts4rFf3fgPTeGi69
- 에비소바 이치겐 : https://maps.app.goo.gl/mcsN8XQ7HRUEBNuh8
- 수프카레 가라쿠 : https://maps.app.goo.gl/PRrnXtR86gTzRFdz8

📌 인스타그램 : jejuisland_girl
#삿포로여행 #홋카이도`;

Deno.test('extractMapLinkEntries — pulls label + url per link line', () => {
  const entries = extractMapLinkEntries(DESC);
  assertEquals(entries.length, 3);
  assertEquals(entries[0].label, '라멘요코초 쿠니미츠');
  assertEquals(entries[0].url, 'https://maps.app.goo.gl/5Ts4rFf3fgPTeGi69');
  assertEquals(entries[1].label, '에비소바 이치겐');
});

Deno.test('extractMapLinkEntries — ignores non-maps lines (instagram, hashtags)', () => {
  const entries = extractMapLinkEntries(DESC);
  // 'jejuisland_girl' line has no maps link → excluded.
  assertEquals(entries.every((e) => e.url.includes('maps')), true);
});

Deno.test('extractMapLinkEntries — empty when no links', () => {
  assertEquals(extractMapLinkEntries('그냥 설명, 링크 없음\n#여행').length, 0);
});

Deno.test('parsePlaceFromMapsUrl — name + coords + /g/ id from resolved Location', () => {
  // Real 302 Location for 에비소바 이치겐 (url-encoded, as returned).
  const loc =
    'https://www.google.co.kr/maps/place/%EC%97%90%EB%B9%84%EC%86%8C%EB%B0%94+%EC%9D%B4%EC%B9%98%EA%B2%90/@43.0512739,141.3428971,17z/data=!3m1!4b1!4m6!3m5!1s0x5f0b298eb2868acf:0x1db6df1ac2901e3!8m2!3d43.05127!4d141.345472!16s%2Fg%2F1tmbvxtz?entry=tts';
  const p = parsePlaceFromMapsUrl(loc);
  assertEquals(p?.name, '에비소바 이치겐');
  assertEquals(p?.lat, 43.05127);
  assertEquals(p?.lng, 141.345472);
  assertEquals(p?.placeId, '/g/1tmbvxtz');
});

Deno.test('parsePlaceFromMapsUrl — falls back to cid when no /g/ id', () => {
  const loc =
    'https://www.google.com/maps/place/Foo+Bar/@35.0,139.0,17z/data=!4m2!3m1!1s0x60188b:0xabc123!3d35.012!4d139.034';
  const p = parsePlaceFromMapsUrl(loc);
  assertEquals(p?.name, 'Foo Bar');
  assertEquals(p?.placeId, 'cid:0x60188b:0xabc123');
});

Deno.test('parsePlaceFromMapsUrl — null when unparseable', () => {
  assertEquals(parsePlaceFromMapsUrl('https://example.com/nope'), null);
});

Deno.test('normalizeName — strips spaces and case for dedup', () => {
  assertEquals(normalizeName('에비소바 이치겐'), normalizeName('에비소바이치겐'));
  assertEquals(normalizeName('Foo Bar'), 'foobar');
});
