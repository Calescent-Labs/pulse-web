# Pulse API — Frontend requests for v1.2 (revised)

_From the Pulse web app team, 2026-02. Revised after backend review._

Frontend is moving from a semantic map with a ranked feed to an **ambient signal instrument with a marketing-shaped landing page**. Three product surfaces gain something:

- **`/` (new landing)** — a 7-day heat timelapse loop using real data, autoplay, ambient.
- **`/map` (was `/`)** — the instrument. Individual signal dots are **hidden by default at low zoom and revealed on zoom-in** — a rendering decision on our side. The API keeps returning points. This preserves the "instrument, not a mood piece" contract.
- **Region investigation (new)** — click any hot region → panel showing the top topics inside it (name, sector, heat, confidence, member count) plus a statistically-computed **coherence** score. **No LLM in v1.2** — this becomes a Pro feature later when there's revenue to fund it. The topics themselves are already labelled and more informative than any paraphrase.

Everything below stays inside the "read-only, derived intelligence only" rule.

Three asks after the merge. Priorities:
- **P0 (blocking)**: request 1, request 2
- **P1**: request 3 (merged, was requests 3+4)

Plus one platform-level ask that isn't an endpoint — **per-IP rate limiting** — flagged in its own section at the bottom.

---

## 1. `GET /v1/map/timelapse` — landing-page animation _(P0, blocking)_

**Surface:** `/` (landing). Autoplay 7-day loop visualising how attention has moved this week. Real data, not marketing filler.

**Why v1 can't serve it:** Naïvely, 168 sequential `/v1/map?asof=…` calls — requires Pro (asof is Pro-gated), blows the 60/min rate limit, and returns ~63 MB of point payloads for one visualisation. Precomputed grids give the same visual at ~40 KB, Free tier, one HTTP call.

**Implementation hint from the backend review:** coordinates don't change between frames (UMAP is fixed within a process); only which events exist and how fast they're moving. So the projection can be computed once and per-frame binning is cheap. 15-minute cache is fine.

**Proposal:**
```
GET /v1/map/timelapse?days=7&resolution=hourly|4h|daily&grid=40
```

Defaults: `days=7`, `resolution=hourly`, `grid=40`. Cap `days` at 30, `grid` at 60.

**Response:**
```json
{
  "data": {
    "bounds": { "minX": -8.2, "maxX": 12.1, "minY": -6.5, "maxY": 9.3 },
    "grid_size": 40,
    "days": 7,
    "resolution_hours": 1,
    "frames": [
      {
        "asof": "2026-08-15T12:00:00+00:00",
        "cells": [[0.01, 0.03, 0.00, "..."], "...40 rows..."]
      }
    ]
  },
  "meta": { "version": "v1.2", "tier": "free", "disclaimer": "...", "generated_at": "..." }
}
```

- `cells[y][x]` is a normalised (0..1) heat density.
- Payload budget: ~40 KB gzipped at 7 days × hourly × 40×40 float16. Two-decimal server-side rounding is fine.
- 15-minute server cache assumed.

**Tier:** Free.

---

## 2. `GET /v1/map` — aggregated response mode, points preserved _(P0, blocking)_

**Surface:** `/map`. We render **heat aggregates by default and points on zoom-in**. Both come from the same fetch — this is a rendering decision on our side, not an API one. Points stay in the payload; `points=false` is a client opt-out for cases where we know we won't render them (like the landing page fallback).

**Why v1 can't serve it:** Today the endpoint only returns `points[]`. To render heat well we also need aggregated cells.

**Proposal:** additive query params, existing behaviour unchanged when clients don't opt in.

```
GET /v1/map?window=24h&asof=&aggregated=hex|grid&resolution=40&points=true|false
```

- `aggregated` (optional, default absent — v1 behaviour). When set, response gains `cells[]` **in addition to** `points[]`.
- `points` (optional, default `true`). Explicit opt-out; when `false`, `points[]` is empty/omitted.
- `resolution` (optional, default `40`). Cell count per side for `grid`; approximate hex bin size for `hex`.

**Response when `aggregated=hex` (with points kept):**
```json
{
  "data": {
    "points": [ /* unchanged v1 shape, kept in default response */ ],
    "cells": [
      {
        "x": 4.10, "y": -2.30,
        "count": 34,
        "mean_velocity": 0.028,
        "mean_heat_percentile": 0.71,
        "topic_ids": [134, 141, 158]
      }
    ],
    "bounds": { "minX": -8.2, "maxX": 12.1, "minY": -6.5, "maxY": 9.3 },
    "reference_size": 6000,
    "cell_size": 0.85,
    "aggregation": "hex"
  },
  "meta": { "..." : "..." }
}
```

- `topic_ids` per cell is **the crucial optional field**. Backend confirmed it's practical to include (top-K by count within cell, K ≤ 5). With this, the client can jump straight from a hex click to topic details without a second round-trip — which is what collapses old request 3 into request 3 below.
- `mean_velocity` and `mean_heat_percentile` let us colour by either dimension in 2D and extrude by either in 3D.
- `bounds` returned here supersedes any client cache if it differs.

**Tier gating:** unchanged. `aggregated` works on both tiers under existing window/asof rules.

**Frontend rendering plan:**
- **2D (default view)**: HeatmapLayer sourced from `cells[]`. Points fade in as the user zooms past a threshold (approximately zoom 8/12 on our OrthographicView), so the map stops being a mood piece the moment someone leans in — instrument behaviour preserved.
- **3D (opt-in view, URL-toggleable via `?view=3d`)**: HexagonLayer extruded by `count`, coloured by `mean_heat_percentile`, opacity dimmed by inferred confidence. Camera on `OrbitView` for pitch/rotate/zoom. Same aggregated payload feeds both views; no additional fetch to switch. Both views also drive the future timelapse imagery and OG cards.
- Existing point-click → topic side-panel behaviour is unchanged (works when zoomed in).

---

## 3. `GET /v1/map/region` — top topics + statistical coherence _(P1)_

_(Collapses the previous requests 3 and 4. The LLM summary is deferred to a future Pro-only feature; v1.2 uses statistical coherence + the already-labelled topics.)_

**Surface:** `/map`. Clicking a hex or heat spot opens a side-panel with an honest read of what's there. No LLM. No fabrication risk. Zero marginal cost.

**Design decision (backend proposal, accepted):** the most useful information at a hot spot is the actual **topics inside it** — already labelled with names, sectors, summaries, entities, heat, confidence, and clickable through to Topic Detail. That's more informative than any paraphrase.

**Coherence** is a statistical honesty gate — mean cosine of member embeddings to the region centroid (the ⚑40 metric). Below a threshold, the panel says so plainly rather than pretending the region is a single story.

**Why the API needs to serve this:** we can approximate top topics client-side from `cells[].topic_ids` in request 2, but the client doesn't have member counts *within the specific circular region the user clicked* (only within the hex cell), and definitely doesn't have coherence. Both belong on the backend where the embeddings live.

**Proposal:**
```
GET /v1/map/region?x=4.1&y=-2.3&radius=1.0&window=24h&asof=&limit=5
```

**Response:**
```json
{
  "data": {
    "coherence": 0.82,
    "member_count": 47,
    "topics": [
      {
        "topic_id": 134,
        "name": "NBA 2K27 Gameplay Reviews",
        "sector": "gaming",
        "subsector": "video game reviews",
        "summary": "…already-labelled short summary…",
        "member_count_in_region": 12,
        "heat_percentile": 0.99,
        "heat_confidence": 0.72,
        "signals": { "velocity": 0.028, "acceleration": 0.011 }
      }
    ]
  },
  "meta": { "..." : "..." }
}
```

- `coherence` is 0..1, honestly reflecting whether these topics genuinely cluster or are a coincidental spatial adjacency. Below ~0.5 the panel dims the topics list and says "this region isn't cohering into a single story right now".
- `member_count` is total content pieces in the region; `member_count_in_region` per topic is what shares that space, which gives an implicit rank.

**Tier:** Free. This *is* the derived intelligence — no reason to gate the labelled data users are already paying for by using the product.

**Future upgrade path (out of scope for v1.2):** when signed-up-Pro exists, add `include=llm_summary` returning a 1–2 sentence LLM narration over these same topics. Budget-cap it globally, cache hard, cost is on Pro revenue not free traffic. The existing `LockedFeature` UI state handles the 402 cleanly.

---

## Platform ask — per-IP rate limiting for the Free tier _(recommended)_

**Why this matters to the frontend:** the landing page ships the Free key inside the browser bundle. Anonymous visitors can extract it; the current 60/min per-key limit becomes a shared bucket that ten simultaneous visitors trip into 429s. Backend has agreed to fix this as part of v1.2 rollout.

**Frontend implications we should agree on:**
- Free key is treated as a **public identifier, not a secret**. We stop pretending otherwise in code comments and docs.
- Landing page will not use any endpoint that requires auth other than the Free identifier (met by request 1 which is Free).
- On 429 responses the UI shows the current friendly "Rate limited, the UI will resume when the window resets" state — no change needed there.
- If per-IP quota gets tight for legitimate use, we can add client-side coalescing on top of React Query's existing 60s staleTime.

---

## Contract stability, still depended on

- Fixed UMAP coordinate space per server process (session-scoped bounds caching on the client).
- `heat_percentile` as a rank, `heat_confidence` always alongside.
- Nulls are normal, gaps drawn not interpolated.
- `meta.disclaimer` on every scored response; surfaced verbatim in the persistent footer.
- The 2026-08-22 series-break marker on any chart spanning it.
- 402 shape with `detail.feature` string; 402 remains a designed UI state, not an error.
- All new endpoints are additive. Existing v1.1 clients keep working unchanged.

## Explicit non-asks

- Raw content, comment text, embeddings — still out of scope by design.
- Write endpoints — still not asking.
- Alerts — still deferred; belongs next to the heat engine when it ships.
- **LLM cluster summary — deferred**. Statistical coherence + labelled topics is the honest answer for v1.2. Rebuilds as a Pro feature later with a hard global daily cap and cache.

## Rollout order

1. **Request 1 (timelapse)** — landing page is fully blocked without it.
2. **Request 2 (aggregated + points preserved)** — enables the map redesign and 3D view.
3. **Request 3 (region investigation)** — the click-a-hex interaction becomes real. Until this lands, clicking a hex can fall back to showing whichever topics are in `cells[].topic_ids` from request 2, without coherence — degraded but functional.
4. **Per-IP rate limiting** — should ship before the landing page goes public to any traffic beyond staging.

Frontend ships in two phases matching this:
- **Phase A (landing)** — ready to build the moment request 1 is live.
- **Phase B (map + region investigation)** — needs requests 2 and 3. The map redesign lands on the same URL as the current map so the existing SHARE LINK state (window/asof/color/heat/topic_id/mode/percentile) carries over untouched. Adds `?view=2d|3d` and `?region=x,y,r` (or similar) to the shareable URL vocabulary.
