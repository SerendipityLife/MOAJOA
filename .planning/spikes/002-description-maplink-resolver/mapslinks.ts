// Resolve description maps.app.goo.gl links DIRECTLY to place identity.
// Key insight: with a NON-browser UA the short link 302-redirects to the full
// /maps/place URL carrying name + exact lat/lng + place id — keyless, no search,
// no Places API cost, no transliteration ambiguity.
//   deno run --allow-net mapslinks.ts

const LINKS: [string, string][] = [
  ['라멘요코초 쿠니미츠', 'https://maps.app.goo.gl/5Ts4rFf3fgPTeGi69'],
  ['에비소바 이치겐', 'https://maps.app.goo.gl/mcsN8XQ7HRUEBNuh8'],
  ['수프카레 가라쿠', 'https://maps.app.goo.gl/PRrnXtR86gTzRFdz8'],
  ['수프카레 스아게', 'https://maps.app.goo.gl/fzPEEujZubN8f3Ad7'],
  ['삿포로 맥주원', 'https://maps.app.goo.gl/Fy9pA9ENyhhhyKxT6'],
];

function parse(loc: string) {
  const dec = decodeURIComponent(loc);
  const name = dec.match(/\/maps\/place\/([^/@]+)/)?.[1]?.replace(/\+/g, ' ');
  const ll = dec.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? dec.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const cid = dec.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1];
  const placeId = dec.match(/!16s%2Fg%2F([0-9a-z]+)/i)?.[1] ?? dec.match(/!16s\/g\/([0-9a-z]+)/i)?.[1];
  return { name, lat: ll?.[1], lng: ll?.[2], cid, placeId: placeId ? `/g/${placeId}` : undefined };
}

let ok = 0;
for (const [koName, short] of LINKS) {
  // redirect:'manual' + plain UA → 302 with Location to the full maps URL.
  const r = await fetch(short, { headers: { 'user-agent': 'curl/8.0' }, redirect: 'manual' });
  const loc = r.headers.get('location');
  console.log(`\n=== ${koName} ===  (HTTP ${r.status})`);
  if (!loc) { console.log('  no Location header'); continue; }
  const p = parse(loc);
  console.log(`  name : ${p.name}`);
  console.log(`  coord: ${p.lat}, ${p.lng}`);
  console.log(`  cid  : ${p.cid}`);
  console.log(`  pid  : ${p.placeId}`);
  if (p.name && p.lat && p.lng) ok++;
}
console.log(`\n>>> resolved ${ok}/${LINKS.length} links to name+coords`);
