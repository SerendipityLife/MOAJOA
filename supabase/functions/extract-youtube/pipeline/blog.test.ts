import { assertEquals } from 'jsr:@std/assert';
import { toNaverPostView } from './blog.ts';

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
