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
- ✅ Map page with fixed bounds, deck.gl scatter + heat, URL sync (`window`, `asof`, `mode`, `percentile`, `topic_id`, `color`, `heat`, `view`), Pro scrubber with play/pause/step
- ✅ Trending page with search (`q`), status/sentiment filters (Pro-gated), sector filter (Pro-gated), min-confidence slider, pagination (Prev/Next), mobile layout
- ✅ Topic detail with velocity/acceleration + percentile + sentiment charts, series-break marker, member list keeping removed items visible, **Related topics** grid (nearest neighbours with closeness %)
- ✅ Map **Moment vs Cumulative** mode toggle with percentile selector (10/25/50/all); API `note` rendered on empty moment windows
- ✅ Map **Focus on topic** — clicking a point → "Focus on map" pins `?topic_id=` in the URL, banner with clear button
- ✅ Persistent disclaimer footer sourced from `meta.disclaimer`
- ✅ Static Open Graph card (`public/og-card.png`, 1200×630) + og/twitter meta in `public/index.html`
- ✅ "Copy share link" button on the Map — copies current URL with full state so any deep link is shareable
- ✅ Session-scoped bounds (invalidated when window/mode changes, matching v1.1 contract note about UMAP re-fitting)
- ✅ Empty-state copy distinguishes "no matches" vs "sentiment data is sparse — most topics don't have comments yet"
- ✅ Status lifecycle caveat surfaced in-context ("lifecycle stages roll out later") when Pro user filters by status
- ✅ Global sign-up modal wired to every "Coming with Pro" pill (placeholder — no backend account system yet)
- ✅ **Landing page 7-day timelapse hero (P0)** — consumes `GET /v1/map/timelapse` (4h res, 42–43 frames, ~9s loop), procedural fallback for cold-tunnel first paint, timelapse watermark with frame counter
- ✅ **Map 3D view (P0)** — toolbar `view=3d` toggle renders extruded hex columns via `/v1/map?aggregated=hex&points=false`. Height = mean_velocity, colour = heat ramp normalised per-frame. Drag to rotate; heat toggle disabled in 3D
- ✅ **Region investigation panel (P0)** — click anywhere on 2D map or on a 3D hex → `GET /v1/map/region` at radius 1.0. Panel shows coherence gauge with 0.5 threshold, "One story" vs "Coincidental adjacency" copy, member/unclustered stats, top-5 topics with in-region counts
- ✅ **Get Notified CTA (P2)** — map toolbar button that opens the placeholder signup modal
- ✅ **Feature-scoped signup modal (P2)** — the triggered feature name lifts to the top of the bullet list; unknown features get promoted as a bespoke lead bullet

## Explicit non-goals

- **No auth, no user accounts, no database on our side.** The frontend must remain portable to any host; anything stateful belongs next to the heat engine.
- **Alerts deferred entirely.** They're a Pro feature for users we don't have yet and would require auth + Mongo + hourly scheduler + email provider — a whole second stateful app. If they ship, they belong on the Pulse backend next to the heat engine that already knows when a threshold was crossed, not here.
- **Dynamic per-URL OG cards deferred.** Would require SSR or an OG-image service; the static card is enough for site-level sharing without adding a backend dependency.

## Known API blockers

None currently. v1.2 contract (2026-08-23) shipped all four requested endpoints:
`/v1/map/timelapse`, `/v1/map?aggregated=hex|grid`, `/v1/map/region`, and per-IP rate limiting on the free key.

## Backlog (post-Phase-B)

- P1: Persist reference UMAP projection across server restarts (backend roadmap; frontend already treats bounds as session-scoped)
- P1: Second data source (Twitter/Reddit/Threads) — will unlock the `platform_mix` chart
- P2: Real per-topic sparkline on Trending (needs bulk history endpoint)
- P2: Payment integration behind a real sign-up flow (auth + billing not yet started)
- P2: Region-panel radius control — currently fixed at 1.0
- P2: `?asof` deeplink → replay the timelapse up to that frame
- P3: `prefers-reduced-motion` — pause the timelapse loop and 3D auto-rotate cues
- P3: Keyboard navigation for ranked list
