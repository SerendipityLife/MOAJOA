---
spike: 002
name: description-maplink-resolver
validates: "Given a travel video whose description lists places as maps.app.goo.gl links, when we resolve each link, then we get authoritative name + exact coords + place id — keyless, no Places Text Search, no transliteration ambiguity"
verdict: VALIDATED
related: [001]
tags: [youtube, places, maps-shortlink, geocoding, extraction-accuracy]
---

# Spike 002: Resolve Description Map-Links Directly

## Origin
Diagnosing the colleague's failing video `l8PRad4T-IY` (삿포로 맛집 모음) flipped the
problem on its head. See `diagnose.ts` output:

- `playabilityStatus: UNPLAYABLE`, but **description (1515 chars) fetched fine** and
  contains **18 places, each with a `maps.app.goo.gl` link** and a Korean name:
  `- 에비소바 이치겐 : https://maps.app.goo.gl/mcsN8XQ7HRUEBNuh8`
- Only caption track is `ko(asr)`, and it is **PoToken-gated to empty** (len 0).

→ **The failure is NOT a transcript gap.** This video needs no transcript — the
description is a clean place list. So the transcript/3rd-party-API direction (spikes
001/003) would not have fixed the colleague's report. Real cause is downstream.

## Likely real failure (in current prod pipeline)
The description names are **Korean transliterations** of Japanese places
("에비소바 이치겐" = えびそば一幻 / Ebisoba Ichigen, "스아게", "가라쿠"). The pipeline
feeds these to Claude → then `resolveGooglePlace()` does a Google Places **Text Search**
with `languageCode: 'ja'` (Sapporo ∉ KO_CITIES, see `index.ts:273-283`). A KO-phonetic
string searched in `ja` frequently matches nothing → `resolved.length === 0` →
`extraction_status: 'manual_review'` (`index.ts:336`). The exact `maps.app.goo.gl`
links — the authoritative answer — are **ignored**.

## What This Validates
That we can skip the lossy name→search round-trip entirely by resolving the links the
creator already provided.

## How to Run
```bash
deno run --allow-net diagnose.ts l8PRad4T-IY   # see the description + caption state
deno run --allow-net mapslinks.ts              # resolve the map links to place identity
```

## Results — VALIDATED ✓  (run 2026-06-13)

**Key mechanism:** `maps.app.goo.gl` short links are JS interstitials for a *browser*
UA (HTTP 200, destination hidden in JS) but **302-redirect for a non-browser UA**
(`curl/8.0`). The `Location` header is the full `/maps/place/...` URL carrying
everything we need.

`mapslinks.ts` → **5/5 links resolved** to name + exact coords + ids:

| KO name in description | Resolved name | coords | place id |
|---|---|---|---|
| 라멘요코초 쿠니미츠 | Kunimitsu Ramen Yokocho | 43.0547, 141.3543 | /g/1ptxqz7d9 |
| 에비소바 이치겐 | 에비소바 이치겐 | 43.0513, 141.3455 | /g/1tmbvxtz |
| 수프카레 가라쿠 | 스프카레 가라쿠 삿포로 본점 | 43.0581, 141.3551 | /g/11clvzwfs6 |
| 수프카레 스아게 | 수프카레 스아게 | 43.0557, 141.3513 | /g/1wn… |
| 삿포로 맥주원 | 삿포로 맥주원 | 43.0713, 141.3691 | /g/1tfcn4bn |

Each `Location` also carries the CID (`!1s0x…:0x…`) and exact lat/lng
(`!3d<lat>!4d<lng>`). Name + coords alone are enough to drop a pin; the place id / CID
let us normalize via one Places **Details** call if we want canonical address/category.

### End-to-end proof (`e2e.ts`, production module, keyless)
Real video `l8PRad4T-IY` → InnerTube description → **production `resolveDescriptionMapLinks`**
→ **18/18 places resolved in ~1.4s** with exact coords. The colleague's failing video now
extracts fully with no Anthropic, no Places API, no DB. (One place — 미소키친 — resolves
~30km south; that is faithfully whatever the creator's link points to.)

### Built (2026-06-13)
- `pipeline/maplinks.ts` + `pipeline/maplinks.test.ts` (7 tests) — resolver.
- `index.ts` wiring: map-link places seed `resolved` in the same shape as
  `resolveGooglePlace`, LLM candidates matching a map-link skip Text Search, `/0`
  guard on avgConfidence. Full suite 51/51 green; claude prompt snapshot unchanged.

### Signal for the build
- **Add a description map-link resolver as the PRIMARY place source** when present.
  Parse `maps.app.goo.gl/*` (and bare `google.com/maps/place/*`) from the description,
  302-resolve with a non-browser UA, emit `{name, lat, lng, cid, placeId}`.
- This is **keyless, $0, exact** — no Text Search, no transliteration mismatch. For the
  very common "creator lists map links" travel video, extraction becomes ~perfect.
- Use a non-browser User-Agent (`curl/8.0`); a Chrome UA gets the 200 interstitial.
- Regex caveat: place-id capture truncated `/g/1wn…` — widen the charset. CID + coords
  are the robust anchors regardless.
- Keep Claude for: the Korean summary, AND places mentioned WITHOUT a link (fall back to
  the existing name→Places path, ideally with `inferred_city` + a KO-name query too).
- Transcript/PoToken (spike 001) is now a **separate, lower-priority** concern — only
  matters for videos that neither list links nor places in the description.
