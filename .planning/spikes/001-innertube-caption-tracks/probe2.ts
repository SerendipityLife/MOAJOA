// Spike 001 probe v2: why were caption tracks absent?
// Tries 4 ways to reach captionTracks for one video, prints diagnostics.
//   deno run --allow-net probe2.ts [videoId]

const ID = Deno.args[0] ?? 'dQw4w9WgXcQ';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

function tracksOf(player: any): any[] {
  return player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}
async function fetchTrackText(baseUrl: string): Promise<number> {
  try {
    const url = baseUrl + (baseUrl.includes('fmt=') ? '' : '&fmt=json3');
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (!res.ok) return -res.status;
    const data = await res.json();
    return (data?.events ?? []).flatMap((ev: any) => (ev.segs ?? []).map((s: any) => s.utf8 ?? '')).join('').trim().length;
  } catch {
    return -999;
  }
}

// (C) Scrape watch page HTML for ytInitialPlayerResponse
async function watchPageScrape(): Promise<any | null> {
  const res = await fetch(`https://www.youtube.com/watch?v=${ID}&hl=en`, {
    headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
  });
  console.log(`(C) watch page HTTP ${res.status}, ${res.headers.get('content-type')}`);
  const html = await res.text();
  const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s);
  if (!m) {
    console.log(`(C) ytInitialPlayerResponse NOT found in HTML (len ${html.length})`);
    return null;
  }
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    console.log(`(C) JSON parse failed: ${(e as Error).message}`);
    return null;
  }
}

// (D) ANDROID innertube client
async function innertube(clientName: string, clientVersion: string, extra: Record<string, unknown> = {}): Promise<any | null> {
  try {
    const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${KEY}&prettyPrint=false`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': UA },
      body: JSON.stringify({ videoId: ID, context: { client: { clientName, clientVersion, hl: 'en', ...extra } } }),
    });
    if (!res.ok) {
      console.log(`  client ${clientName} HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.log(`  client ${clientName} threw ${(e as Error).message}`);
    return null;
  }
}

console.log(`=== ${ID} ===`);

// WEB (what prod uses) — show top-level keys + whether captions exists
const web = await innertube('WEB', '2.20250101.00.00');
console.log(`(WEB) keys: ${web ? Object.keys(web).join(',') : 'null'}`);
console.log(`(WEB) has .captions? ${!!web?.captions}  tracks: ${tracksOf(web).length}`);

// ANDROID
const android = await innertube('ANDROID', '19.09.37', { androidSdkVersion: 30 });
const aTracks = tracksOf(android);
console.log(`(D ANDROID) has .captions? ${!!android?.captions}  tracks: ${aTracks.length} [${aTracks.map((t: any) => t.languageCode + (t.kind === 'asr' ? '(asr)' : '')).join(',')}]`);
if (aTracks.length) console.log(`(D ANDROID) first track text: ${await fetchTrackText(aTracks[0].baseUrl)} chars`);

// WEB embedded player client (often retains captions)
const emb = await innertube('WEB_EMBEDDED_PLAYER', '1.20250101.00.00');
const eTracks = tracksOf(emb);
console.log(`(WEB_EMBEDDED) has .captions? ${!!emb?.captions}  tracks: ${eTracks.length}`);

// (C) watch page
const wp = await watchPageScrape();
const cTracks = tracksOf(wp);
console.log(`(C scrape) has .captions? ${!!wp?.captions}  tracks: ${cTracks.length} [${cTracks.map((t: any) => t.languageCode + (t.kind === 'asr' ? '(asr)' : '')).join(',')}]`);
if (cTracks.length) console.log(`(C scrape) first track text: ${await fetchTrackText(cTracks[0].baseUrl)} chars`);
