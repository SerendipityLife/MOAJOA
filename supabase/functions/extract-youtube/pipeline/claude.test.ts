import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { LLMOutput } from './claude.ts';

Deno.test('LLMOutput accepts place WITH summary_ko', () => {
  const result = LLMOutput.parse({
    places: [{ name_local: '스시O', source_quote: 'q', summary_ko: '1~2문장' }],
  });
  assertEquals(result.places[0].summary_ko, '1~2문장');
});

Deno.test('LLMOutput accepts place WITHOUT summary_ko (optional)', () => {
  const result = LLMOutput.parse({
    places: [{ name_local: '스시O', source_quote: 'q' }],
  });
  assertEquals(result.places[0].summary_ko, undefined);
});

Deno.test('LLMOutput accepts video_summary_ko', () => {
  const result = LLMOutput.parse({ places: [], video_summary_ko: '영상 TL;DR' });
  assertEquals(result.video_summary_ko, '영상 TL;DR');
});

Deno.test('LLMOutput accepts omitted video_summary_ko', () => {
  const result = LLMOutput.parse({ places: [] });
  assertEquals(result.video_summary_ko, undefined);
});

Deno.test('LLMOutput rejects non-string summary_ko', () => {
  assertThrows(() =>
    LLMOutput.parse({
      places: [{ name_local: 'x', source_quote: 'q', summary_ko: 123 }],
    })
  );
});
