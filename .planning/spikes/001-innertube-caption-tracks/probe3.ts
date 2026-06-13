// Spike 001 probe v3: can we actually DOWNLOAD a caption track baseUrl
// obtained from the watch-page ytInitialPlayerResponse?
//   deno run --allow-net probe3.ts [videoId]

const ID = Deno.args[0] ?? 'dQw4w9WgXcQ';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const res = await fetch(`https://www.youtube.com/watch?v=${ID}&hl=en`, {
  headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
});
const html = await res.text();
const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s);
if (!m) { console.log('no playerResponse'); Deno.exit(1); }
const player = JSON.parse(m[1]);
const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
console.log(`${tracks.length} tracks`);

for (const t of tracks.slice(0, 3)) {
  console.log(`\n--- ${t.languageCode}${t.kind === 'asr' ? '(asr)' : ''} ---`);
  console.log(`baseUrl host/params: ${t.baseUrl.replace(/^https:\/\/[^?]+/, '...').slice(0, 220)}`);
  for (const variant of ['', '&fmt=json3', '&fmt=srv3']) {
    const url = t.baseUrl + variant;
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, referer: `https://www.youtube.com/watch?v=${ID}` } });
      const body = await r.text();
      console.log(`  fmt='${variant || 'default'}' → HTTP ${r.status} ${r.headers.get('content-type')} len=${body.length}  head="${body.slice(0, 60).replace(/\n/g, ' ')}"`);
    } catch (e) {
      console.log(`  fmt='${variant || 'default'}' → threw ${(e as Error).message}`);
    }
  }
}
