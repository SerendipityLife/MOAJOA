import { describe, expect, it } from 'vitest';
import { extractYouTubeVideoId, buildYouTubeWatchUrl } from '@/lib/youtube';

describe('extractYouTubeVideoId', () => {
  it('extracts from youtube.com/watch?v=', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });
  it('extracts from youtu.be short link', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('extracts from youtube.com/embed', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });
  it('ignores trailing query params', () => {
    expect(
      extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxx'),
    ).toBe('dQw4w9WgXcQ');
  });
  it('returns null for non-YouTube URLs', () => {
    expect(extractYouTubeVideoId('https://example.com/not-youtube')).toBeNull();
  });
  it('returns null for /shorts/ (out of scope v1)', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(extractYouTubeVideoId('')).toBeNull();
  });
});

describe('buildYouTubeWatchUrl', () => {
  it('appends &t=Ns when timestamp > 0', () => {
    expect(
      buildYouTubeWatchUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 120),
    ).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s');
  });
  it('omits &t when timestamp is null', () => {
    expect(buildYouTubeWatchUrl('https://youtu.be/dQw4w9WgXcQ', null)).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });
  it('omits &t when timestamp is 0', () => {
    expect(buildYouTubeWatchUrl('https://youtu.be/dQw4w9WgXcQ', 0)).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });
  it('omits &t when fractional timestamp floors to 0', () => {
    expect(buildYouTubeWatchUrl('https://youtu.be/dQw4w9WgXcQ', 0.7)).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });
  it('floors fractional timestamps', () => {
    expect(buildYouTubeWatchUrl('https://youtu.be/dQw4w9WgXcQ', 60.9)).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=60s',
    );
  });
  it('returns null for non-YouTube URLs', () => {
    expect(buildYouTubeWatchUrl('https://example.com/not-yt', 120)).toBeNull();
  });
});
