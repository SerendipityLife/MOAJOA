---
spike: 001
name: innertube-caption-tracks
validates: "Given a real video, when we read captionTracks[].baseUrl from the InnerTube player / watch-page and fetch it, then we get real transcript text without any API key or signup"
verdict: INVALIDATED
related: []
tags: [youtube, transcript, captions, innertube, potoken, edge-function]
---

# Spike 001: InnerTube Caption Tracks (keyless)

## What This Validates
Given a real YouTube video, when we obtain `captionTracks[].baseUrl` (the modern,
signed timedtext URL) and fetch it, then we get real transcript text — keyless, no
signup, runnable inside a Deno Edge Function. This would solve the "transcript empty
from server" problem cheaply, reusing the InnerTube call the code already makes.

## How to Run
```bash
deno run --allow-net spike.ts            # default video dQw4w9WgXcQ
deno run --allow-net probe2.ts           # which client exposes captionTracks
deno run --allow-net probe3.ts           # can we DOWNLOAD a track baseUrl?
# pass real KR 여행/맛집 video IDs as args to test representative content
```

## What to Expect
A working method prints `>>> MODERN best: <lang> <N> chars` with N in the thousands
and a readable sample line.

## Results — INVALIDATED ✗  (run 2026-06-13, residential IP)

The keyless path **cannot download transcript text**. Evidence, in order of discovery:

1. **InnerTube `player` API returns NO `captions` object** for WEB / ANDROID /
   WEB_EMBEDDED clients. `player.captions` is `false`/absent; 0 tracks.
   (`spike.ts`, `probe2.ts`) — ANDROID client also 400s with the public WEB key.
   → The description-grounding the prod code relies on still works (videoDetails is
     present), but captions are simply not in this response.

2. **The watch-page HTML (`ytInitialPlayerResponse`) DOES list caption tracks** —
   6 tracks for dQw4w9WgXcQ (`en, en(asr), de-DE, ja, pt-BR, es-419`). So the track
   *list* is reachable by scraping `https://www.youtube.com/watch?v=...`. (`probe2.ts`)

3. **But fetching any track `baseUrl` returns HTTP 200 with an EMPTY body (len=0)** —
   for every fmt (`default`, `json3`, `srv3`). (`probe3.ts`)
   The signed baseUrl params are:
   `...&caps=asr&...&ip=0.0.0.0&ipbits=0&expire=...&sparams=...&signature=...`
   — note there is **no `pot=` parameter**.

### Root cause
YouTube's timedtext endpoint now requires a **PoToken (Proof-of-Origin Token)**.
Without it, the signed caption URL returns an empty 200. Generating a PoToken means
running YouTube's BotGuard JS challenge (visitorData + a JS VM, e.g. bgutils-js +
headless/Deno-incompatible runtime). This is **not feasible in a lightweight Deno
Edge Function**.

### Decision-relevant correction
This failure happens on a **residential IP**, not just datacenter IPs. So the prod
code comment in `youtube.ts:85-86` ("timedtext transcripts are bot-gated to empty
**from server IPs**") is **misdiagnosed** — the blocker is the missing PoToken, which
no IP fixes. Spike 002 (datacenter-IP confirm) is therefore moot *for this method*:
it already fails everywhere keyless.

### What this kills / leaves standing
- ✗ Keyless InnerTube/scrape transcript download — dead without a PoToken provider.
- ✗ "Just switch to the modern caption-track URL" — same PoToken wall.
- ✓ Track *listing* via HTML scrape works (we can know which languages exist).
- ✓ Description grounding (videoDetails) is unaffected — current fallback still valid.

### Residual uncertainty
Tested on one heavily-monitored video (Rick Astley) from one residential IP. The
PoToken requirement is a YouTube-wide rollout, not video-specific, so the mechanism
finding generalizes — but a real KR 여행/맛집 video should be spot-checked before the
build commits. (Pass its ID to the scripts.)

### Signal for the build
Realistic transcript paths now narrow to:
- **(A) Third-party transcript API** (supadata / youtube-transcript.io / searchapi) —
  they run PoToken/BotGuard solvers on their own infra. → spike 003. Cost + reliability
  are the open questions.
- **(B) Self-host a PoToken provider** (bgutils + a JS runtime sidecar) — heavy,
  fragile, ongoing maintenance. Likely overkill for v1.
- **(C) Accept description-only** + set `YOUTUBE_API_KEY` for full description.
  Cheapest; abandons "places spoken only in audio."
