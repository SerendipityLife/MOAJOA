import { assertRejects, assertStringIncludes } from 'jsr:@std/assert';
import { fetchInstagramContent } from './instagram.ts';

Deno.test('fetchInstagramContent rejects — never returns a SourceContent', async () => {
  await assertRejects(() => fetchInstagramContent('https://www.instagram.com/p/abc/'));
});

Deno.test('fetchInstagramContent error message is an explicit Korean instagram: reason', async () => {
  const err = await assertRejects(() =>
    fetchInstagramContent('https://www.instagram.com/p/abc/')
  );
  assertStringIncludes((err as Error).message, 'instagram:');
  assertStringIncludes((err as Error).message, '자동 추출');
});
