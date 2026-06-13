// Keyless end-to-end proof: real video l8PRad4T-IY → description (InnerTube) →
// PRODUCTION maplinks module → places with exact coords. No Anthropic, no Places
// API, no DB. Proves the colleague's failing video now extracts.
//   deno run --allow-net e2e.ts [videoId]

import { resolveDescriptionMapLinks } from '../../../supabase/functions/extract-youtube/pipeline/maplinks.ts';

const ID = Deno.args[0] ?? 'l8PRad4T-IY';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

// Same keyless description fetch the prod pipeline uses (InnerTube WEB videoDetails).
const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${KEY}&prettyPrint=false`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'user-agent': UA, origin: 'https://www.youtube.com', referer: `https://www.youtube.com/watch?v=${ID}` },
  body: JSON.stringify({ videoId: ID, context: { client: { clientName: 'WEB', clientVersion: '2.20250101.00.00' } } }),
});
const data = await res.json();
const desc = data?.videoDetails?.shortDescription ?? '';
console.log(`video: ${data?.videoDetails?.title}`);
console.log(`description: ${desc.length} chars\n`);

const t0 = performance.now();
const places = await resolveDescriptionMapLinks(desc);
const ms = Math.round(performance.now() - t0);

console.log(`>>> ${places.length} places resolved in ${ms}ms (keyless, no Text Search):\n`);
for (const p of places) {
  console.log(`  • ${p.label}  →  ${p.name}  @ ${p.lat},${p.lng}  [${p.placeId}]`);
}
