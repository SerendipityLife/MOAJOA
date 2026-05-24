import { assertEquals } from 'jsr:@std/assert';
import { extractVideoId, normalizeYouTubeUrl } from './youtube.ts';

Deno.test('extractVideoId — watch?v=', () => {
  assertEquals(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

Deno.test('extractVideoId — youtu.be short link', () => {
  assertEquals(extractVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

Deno.test('extractVideoId — shorts', () => {
  assertEquals(extractVideoId('https://www.youtube.com/shorts/AbCdEfGh123'), 'AbCdEfGh123');
});

Deno.test('extractVideoId — invalid host', () => {
  assertEquals(extractVideoId('https://vimeo.com/12345'), null);
});

Deno.test('extractVideoId — malformed URL', () => {
  assertEquals(extractVideoId('not a url'), null);
});

Deno.test('normalizeYouTubeUrl — always canonical watch?v=', () => {
  assertEquals(
    normalizeYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=42'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  );
});
