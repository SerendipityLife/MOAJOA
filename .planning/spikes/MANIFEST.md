# Spike Manifest

## Idea
Determine a reliable way to obtain YouTube transcripts from a server (Supabase Edge
Function / Deno) environment. The prod code's `timedtext` fetch returns empty and the
extraction pipeline silently degrades to description-only grounding. Validate candidate
approaches — keyless InnerTube/caption-track, third-party transcript APIs, description
fallback — with cost / reliability / ToS tradeoffs before committing to a build.

## Spikes

| # | Name | Validates | Verdict | Tags |
|---|------|-----------|---------|------|
| 001 | innertube-caption-tracks | Keyless caption-track baseUrl download yields transcript text | INVALIDATED ✗ | youtube, transcript, potoken |
| 002 | description-maplink-resolver | Resolving description maps.app.goo.gl links yields exact name+coords+id, keyless | VALIDATED ✓ | places, maps-shortlink, extraction-accuracy |

## Pivot note (2026-06-13)
Diagnosing the colleague's failing video (`l8PRad4T-IY`) showed the real problem is NOT
transcripts. Its description lists 18 places with map links; transcript is irrelevant.
The fix is **spike 002** (resolve description map-links directly), not a transcript API.
Spike 001's transcript work is deferred to videos with no description place list.
