// Description map-link resolver.
//
// Korean travel/맛집 YouTube descriptions very commonly list every place as a
// `maps.app.goo.gl` short link next to its name, e.g.:
//   - 에비소바 이치겐 : https://maps.app.goo.gl/mcsN8XQ7HRUEBNuh8
//
// These links are authoritative: resolving the 302 yields the exact place name,
// coordinates, and Google place id — no Places Text Search, no transliteration
// mismatch, no API key, no cost. (Spike 002 validated 5/5 on l8PRad4T-IY.)
//
// Pitfall: with a *browser* User-Agent the short link returns a 200 JS
// interstitial that hides the destination. With a non-browser UA it 302s to the
// full /maps/place URL. So we MUST send a plain UA and read the Location header.

export interface MapLinkPlace {
  /** Creator-written name beside the link (usually Korean). Used to dedup vs LLM. */
  label: string;
  /** Canonical place name parsed from the resolved maps URL. */
  name: string;
  lat: number;
  lng: number;
  /** Stable google id: `/g/…` knowledge-graph id when present, else `cid:0x…:0x…`. */
  placeId: string;
  /** The description line, kept as the place's source_quote. */
  sourceQuote: string;
}

const SHORTLINK_RE = /https?:\/\/maps\.app\.goo\.gl\/[A-Za-z0-9]+/;
const FULLMAPS_RE = /https?:\/\/(?:www\.)?google\.[a-z.]+\/maps\/place\/[^\s"')]+/;
// Either form, anywhere on a line.
const ANY_MAPLINK_RE = new RegExp(`(${SHORTLINK_RE.source})|(${FULLMAPS_RE.source})`);

interface MapLinkEntry {
  label: string;
  url: string;
  line: string;
}

/**
 * Pull `{label, url, line}` for every description line that carries a maps link.
 * Label = the text before the URL on that line, stripped of bullets/colon.
 */
export function extractMapLinkEntries(description: string): MapLinkEntry[] {
  const out: MapLinkEntry[] = [];
  for (const rawLine of description.split('\n')) {
    const line = rawLine.trim();
    const m = line.match(ANY_MAPLINK_RE);
    if (!m) continue;
    const url = m[0];
    const before = line.slice(0, m.index ?? 0);
    // Strip leading bullets/dashes/numbering and a trailing colon/separator.
    const label = before
      .replace(/^[\s\-–—•·*]+/, '')
      .replace(/[\s:：·\-–—]+$/, '')
      .trim();
    out.push({ label, url, line });
  }
  return out;
}

/** Parse name + coords + id out of a resolved `/maps/place/...` URL (decoded). */
export function parsePlaceFromMapsUrl(mapsUrl: string): Omit<MapLinkPlace, 'label' | 'sourceQuote'> | null {
  const dec = decodeURIComponent(mapsUrl);
  const name = dec.match(/\/maps\/place\/([^/@]+)/)?.[1]?.replace(/\+/g, ' ').trim();
  const ll = dec.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? dec.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const gid = dec.match(/!16s\/g\/([0-9a-zA-Z]+)/)?.[1];
  const cid = dec.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i)?.[1];
  if (!name || !ll) return null;
  const placeId = gid ? `/g/${gid}` : cid ? `cid:${cid}` : '';
  if (!placeId) return null;
  return { name, lat: Number(ll[1]), lng: Number(ll[2]), placeId };
}

/** Resolve one map link (short or full) to place identity. null on any failure. */
export async function resolveMapLink(url: string): Promise<Omit<MapLinkPlace, 'label' | 'sourceQuote'> | null> {
  // A full /maps/place URL is already the destination — parse without a request.
  if (FULLMAPS_RE.test(url)) {
    const direct = parsePlaceFromMapsUrl(url);
    if (direct) return direct;
  }
  try {
    // Non-browser UA → 302 with Location to the full maps URL.
    const res = await fetch(url, { headers: { 'user-agent': 'curl/8.0' }, redirect: 'manual' });
    const loc = res.headers.get('location');
    if (!loc) return null;
    return parsePlaceFromMapsUrl(loc);
  } catch {
    return null;
  }
}

/**
 * Resolve every map link in a description, concurrently. De-dupes by placeId so a
 * place linked twice yields one row. Order follows first appearance.
 */
export async function resolveDescriptionMapLinks(description: string): Promise<MapLinkPlace[]> {
  const entries = extractMapLinkEntries(description);
  if (entries.length === 0) return [];

  const resolved = await Promise.all(
    entries.map(async (e) => {
      const place = await resolveMapLink(e.url);
      if (!place) return null;
      return { ...place, label: e.label, sourceQuote: e.line.slice(0, 200) } as MapLinkPlace;
    }),
  );

  const seen = new Set<string>();
  const out: MapLinkPlace[] = [];
  for (const p of resolved) {
    if (!p || seen.has(p.placeId)) continue;
    seen.add(p.placeId);
    out.push(p);
  }
  return out;
}

/** Normalize a name for fuzzy dedup against LLM candidates (strip spaces/case). */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[\s·・]/g, '');
}
