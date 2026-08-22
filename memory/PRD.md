# Pulse — Frontend PRD

_Last updated: 2026-02_

## Original problem statement (verbatim excerpt)

Build the public web app for **Pulse**, a trend-intelligence product by Calescent Labs.
Three surfaces: **The Map** (semantic 2-D map with heat field + time-scrub), **Trending Now** (ranked topics), **Topic Detail** (heat curve, sentiment, members). All data from the live read-only API (`https://calescent-api.duckdns.org`). No backend on our side. Honesty is a hard requirement: never show a score without its confidence; never call anything a verified trend; always show sentiment sample sizes.

Source docs: `PRODUCT_BRIEF.md`, `DESIGN_BRIEF.md`, `DATA_CONTRACT.md`.

## User personas

- **Creators & social teams** — need a few hours' head start on what to make next.
- **Brand & comms teams** — watching for stories entering their space.
- **Researchers / journalists** — tracking how attention moves between communities.

## Core requirements (static)

- Frontend-only React SPA consuming the live Pulse API. **No backend built on our side.**
- Single typed data-access module (`src/lib/pulseClient.js`). Components never call fetch/axios directly.
- Env-driven config only (`REACT_APP_PULSE_API_BASE`, `REACT_APP_PULSE_KEY_FREE`, `REACT_APP_PULSE_KEY_PRO`, `REACT_APP_DEV_TIER_TOGGLE`).
- Tier gating: server-side. UI reacts to 402 with a first-class `LockedFeature` state naming the capability.
- Honesty: heat percentile ALWAYS paired with confidence; sentiment shows mean + polarisation + sample size; series-break marker at 2026-08-22; gaps drawn, never interpolated.
- Dark, editorial, dense. IBM Plex Sans + IBM Plex Mono. One saturated accent (heat ramp).
- Map: canvas/WebGL (deck.gl), fixed coordinate space, scrubber debounced, URL-synced state.
- Ranked views must be good on mobile.
- Rate limit: React Query 60s staleTime; no polling faster than 60s.

## Architecture

```
src/
  lib/
    pulseClient.js     — single fetch module; typed via JSDoc against DATA_CONTRACT.md
    tierContext.jsx    — free/pro state, dev-only toggle
    queries.js         — React Query hooks (health, topics, topic, map, sectors)
    format.js          — presentation helpers (percentile, confidence, series-break, etc.)
    heat.js            — heat ramp shared between DOM & deck.gl
  components/
    AppShell.jsx       — nav, health/staleness banner, tier toggle, disclaimer footer
    HeatBadge.jsx      — percentile + confidence (visual weight tied to confidence)
    SentimentIndicator — mean + polarisation + n; "divided" state distinct from "indifferent"
    StatusChip.jsx     — designed for all six statuses (emerging → dormant)
    Sparkline.jsx      — gap-aware, no interpolation
    LockedFeature.jsx  — 402 UI state, describes the feature
    ErrorState.jsx     — 401/402/429/503 routed sensibly
    NoKeyState.jsx     — clear message when REACT_APP_PULSE_KEY_FREE is empty
    Disclaimer.jsx     — persistent footer with meta.disclaimer
    MapCanvas.jsx      — deck.gl (ScatterplotLayer + HeatmapLayer, OrthographicView)
  pages/
    MapPage.jsx        — window selector, colour-by, heat toggle, Pro scrubber, hover + side-panel
    TrendingPage.jsx   — sector filter (pro-gated), min-confidence, ranked rows
    TopicDetailPage.jsx— heat curve, sentiment traj, member list, entity chips, series-break marker
```

## What's implemented (2026-02)

- ✅ Data-access module with 402/401/429/503 typed error branches
- ✅ Free/Pro tier context with dev-only toggle (env-gated)
- ✅ Health/staleness banner (>2h old → "stale")
- ✅ Map page with fixed bounds, deck.gl scatter + heat, URL sync (`window`, `asof`, `mode`, `color`, `heat`), Pro scrubber with play/pause/step
- ✅ Trending page with sector filter (pro-gated, shows LockedFeature), min-confidence slider, mobile layout
- ✅ Topic detail with velocity/acceleration + percentile + sentiment charts, series-break marker, member list keeping removed items visible
- ✅ Persistent disclaimer footer sourced from `meta.disclaimer`

## Known API blockers (batched — see finish summary for details)

Nice-to-haves and one degrader that the current v1 API can't serve. Detailed request specs are in the finish summary; each will be handed to the backend team.

## Backlog (post-first-finish)

- P1: Full **Moment vs Cumulative** map mode (needs backend param) — currently Cumulative only, Moment toggle hidden
- P1: Related topics on Topic Detail (nearest-neighbour)
- P1: Search across topics (Trending)
- P2: Filter by status / sentiment on Trending
- P2: Map points filtered to a single topic (highlight instead of refetch)
- P2: Aggregate stats for a landing page
- P2: Real per-topic sparkline on Trending (needs bulk history endpoint)
- P2: Payment integration behind the Upgrade CTA
- P3: `prefers-reduced-motion` — scrubber play mode already inert; audit rest
- P3: Keyboard navigation for ranked list
