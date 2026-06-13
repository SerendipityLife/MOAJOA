// Spike 001: InnerTube caption-track fetch (keyless, no signup)
//
// Question: Does reading captionTracks[].baseUrl from the InnerTube player
// response (which extract-youtube ALREADY fetches for the description) and
// fetching that signed URL yield a real transcript — unlike the bare
// `timedtext?v=...&lang=ko` pattern the current code uses?
//
// Run (Deno, representative of the Edge runtime — but on THIS machine's
// residential IP, so success here does NOT prove server/datacenter behavior;
// that is spike 002):
//   deno run --allow-net spike.ts [videoId ...]
//
// Default video: dQw4w9WgXcQ (guaranteed-live, multi-language captions —
// proves the mechanism). Pass real KR 여행/맛집 video IDs as args to test
// representative content.

const IDS = Deno.args.length > 0 ? Deno.args : ['dQw4w9WgXcQ'];

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'; // public WEB-client key (same as prod code)

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // "asr" for auto-generated
  name?: { simpleText?: string; runs?: { text: string }[] };
}

async function innertubePlayer(videoId: string): Promise<any | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': UA,
          origin: 'https://www.youtube.com',
          referer: `https://www.youtube.com/watch?v=${videoId}`,
        },
        body: JSON.stringify({
          videoId,
          context: { client: { clientName: 'WEB', clientVersion: '2.20250101.00.00' } },
        }),
      },
    );
    if (!res.ok) {
      console.log(`  [innertube] HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.log(`  [innertube] threw: ${(e as Error).message}`);
    return null;
  }
}

// (A) Modern method: caption tracks from the player response.
async function fetchViaCaptionTracks(player: any): Promise<{ lang: string; chars: number; sample: string }[]> {
  const tracks: CaptionTrack[] =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (tracks.length === 0) {
    console.log('  [tracks] NONE in player response');
    return [];
  }
  console.log(
    `  [tracks] ${tracks.length} available: ` +
      tracks
        .map((t) => `${t.languageCode}${t.kind === 'asr' ? '(asr)' : ''}`)
        .join(', '),
  );
  const out: { lang: string; chars: number; sample: string }[] = [];
  for (const t of tracks) {
    try {
      const url = t.baseUrl + (t.baseUrl.includes('fmt=') ? '' : '&fmt=json3');
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (!res.ok) {
        console.log(`    - ${t.languageCode}: baseUrl HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const text = (data?.events ?? [])
        .flatMap((ev: any) => (ev.segs ?? []).map((s: any) => s.utf8 ?? ''))
        .join('')
        .trim();
      console.log(`    - ${t.languageCode}${t.kind === 'asr' ? '(asr)' : ''}: ${text.length} chars`);
      out.push({ lang: `${t.languageCode}${t.kind === 'asr' ? '(asr)' : ''}`, chars: text.length, sample: text.slice(0, 80) });
    } catch (e) {
      console.log(`    - ${t.languageCode}: threw ${(e as Error).message}`);
    }
  }
  return out;
}

// (B) Old method the current prod code uses — bare endpoint, guessed lang.
async function fetchBareTimedtext(videoId: string, lang: string, asr: boolean): Promise<number> {
  const url = new URL('https://www.youtube.com/api/timedtext');
  url.searchParams.set('v', videoId);
  url.searchParams.set('lang', lang);
  url.searchParams.set('fmt', 'json3');
  if (asr) url.searchParams.set('kind', 'asr');
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return -res.status; // negative = http error
    const data = await res.json();
    const text = (data?.events ?? [])
      .flatMap((ev: any) => (ev.segs ?? []).map((s: any) => s.utf8 ?? ''))
      .join('')
      .trim();
    return text.length;
  } catch {
    return -1;
  }
}

for (const id of IDS) {
  console.log(`\n=== ${id} ===`);
  const player = await innertubePlayer(id);
  const title = player?.videoDetails?.title;
  if (!title) {
    console.log(`  DEAD/blocked: no videoDetails (playability=${player?.playabilityStatus?.status ?? 'unknown'})`);
    continue;
  }
  console.log(`  title: ${title}`);
  console.log(`  (A) MODERN — caption tracks from player response:`);
  const modern = await fetchViaCaptionTracks(player);
  console.log(`  (B) OLD — bare timedtext (what prod code does now):`);
  for (const [lang, asr] of [['ko', false], ['ja', false], ['en', false], ['ko', true], ['en', true]] as [string, boolean][]) {
    const n = await fetchBareTimedtext(id, lang, asr);
    console.log(`    - ${lang}${asr ? '(asr)' : ''}: ${n >= 0 ? `${n} chars` : `ERR ${n}`}`);
  }
  const best = modern.reduce((a, b) => (b.chars > a.chars ? b : a), { lang: '-', chars: 0, sample: '' });
  console.log(`  >>> MODERN best: ${best.lang} ${best.chars} chars  |  sample: "${best.sample}"`);
}
