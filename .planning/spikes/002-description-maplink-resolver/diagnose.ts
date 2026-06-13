// Diagnose a specific video: what grounding does the CURRENT pipeline actually
// get? (description from InnerTube + caption availability). Reveals whether a
// failed extraction is a transcript gap or a description gap.
//   deno run --allow-net diagnose.ts <videoId>

const ID = Deno.args[0] ?? 'l8PRad4T-IY';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

// What prod's keyless path sees: InnerTube WEB player videoDetails.
const ires = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${KEY}&prettyPrint=false`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'user-agent': UA, origin: 'https://www.youtube.com', referer: `https://www.youtube.com/watch?v=${ID}` },
  body: JSON.stringify({ videoId: ID, context: { client: { clientName: 'WEB', clientVersion: '2.20250101.00.00' } } }),
});
const idata = ires.ok ? await ires.json() : null;
const vd = idata?.videoDetails;
console.log(`=== ${ID} ===`);
console.log(`playability: ${idata?.playabilityStatus?.status}`);
console.log(`title: ${vd?.title}`);
console.log(`author: ${vd?.author}`);
console.log(`lengthSeconds: ${vd?.lengthSeconds}`);
const desc = vd?.shortDescription ?? '';
console.log(`\n--- DESCRIPTION (${desc.length} chars) ---`);
console.log(desc.slice(0, 2500));
console.log(desc.length > 2500 ? `\n...[truncated ${desc.length - 2500} more chars]` : '');

// Caption track availability via watch-page scrape.
const wres = await fetch(`https://www.youtube.com/watch?v=${ID}&hl=ko`, { headers: { 'user-agent': UA, 'accept-language': 'ko,en;q=0.9' } });
const html = await wres.text();
const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s);
const wp = m ? JSON.parse(m[1]) : null;
const tracks = wp?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
console.log(`\n--- CAPTION TRACKS (${tracks.length}) ---`);
for (const t of tracks) {
  console.log(`  ${t.languageCode}${t.kind === 'asr' ? '(asr)' : ''} — ${t.name?.simpleText ?? t.name?.runs?.[0]?.text ?? ''}`);
}
if (tracks[0]) {
  const r = await fetch(tracks[0].baseUrl + '&fmt=json3', { headers: { 'user-agent': UA } });
  const b = await r.text();
  console.log(`  [download test] track[0] → HTTP ${r.status}, body len ${b.length} (0 = PoToken-gated)`);
}
