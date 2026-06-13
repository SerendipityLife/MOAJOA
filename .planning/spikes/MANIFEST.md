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
