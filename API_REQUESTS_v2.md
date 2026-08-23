# Pulse API — Frontend requests for v1.2

_From the Pulse web app team, 2026-02._

Frontend is moving from a semantic map with a ranked feed to an **ambient signal instrument with a marketing-shaped landing page**. Three product surfaces gain something:

- **`/` (new landing)** — a 7-day heat timelapse loop using real data, autoplay, ambient.
- **`/map` (was `/`)** — the instrument. Individual signal dots removed; we render heat regions only. Both **2D (default)** and **3D (opt-in)** using the same aggregated payload.
- **Cluster investigation (new)** — click any hot region → LLM-generated read of what the cluster is about. **Pro** users additionally see the top topics inside that region, linked to Topic Detail.

Everything below stays inside the "read-only, derived intelligence only" rule. No raw content, no comments, no embeddings, no write endpoints.

Four asks, ordered by criticality. Priorities on the current backlog:
- **P0 (blocking)**: request 1, request 2
- **P0 (blocking) for the AI cluster read only**: request 4
- **P1 (nice-to-have — may become free if request 2 carries `topic_ids`)**: request 3

---

## 1. `GET /v1/map/timelapse` — landing-page animation _(P0, blocking)_

**Surface:** `/` (landing). An autoplay 7-day loop that visualises how attention has moved this week. Real data, not marketing filler.

**Priority:** P0 — the landing page is blocked without it. It is the entire visual.

**Why v1 can't serve it:**
- Naïve approach: 168 sequential `GET /v1/map?asof=…` calls. Requires Pro (asof is Pro-gated), blows the 60/min rate limit, and returns ~63 MB of point payloads for a single frame render. Landing pages need to be fast for anonymous visitors on cold caches.
- Precomputed grids give us the same visual at ~40 KB total, Free tier, one HTTP call.

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

- `cells[y][x]` is a normalised (0..1) heat density for that grid cell at that frame's `asof`.
- Payload budget: ~40 KB gzipped for 7 days × hourly × 40×40 float16 grids. Aggressive server-side rounding to 2 decimals is fine.
- Server can cache this endpoint for 15+ minutes — landing page traffic will hammer it.

**Tier:** Free. This is the ambient front door.

**Frontend rendering plan:**
- We iterate `frames` at ~4 fps into a `<canvas>` via a scalar-field colouriser (same heat ramp as the Map).
- No individual points, no interaction — pure ambient.
- Small "as of {latest asof}" overlay for honesty. Disclaimer honoured in the persistent footer as today.

---

## 2. `GET /v1/map` — aggregated response mode _(P0, blocking)_

**Surface:** `/map` (the instrument). We are removing the per-point scatter and rendering hex/heat aggregates only. This means we should also stop shipping thousands of points to the client per fetch.

**Why v1 can't serve it:** Today the endpoint always returns `points[]`. To render heat well we need aggregated cells; sending both is wasteful.

**Proposal:** additive query params — existing behaviour unchanged when clients don't opt in.

```
GET /v1/map?window=24h&asof=&aggregated=hex|grid&resolution=40&points=false
```

- `aggregated` (optional, default absent — v1 behaviour). When set, response includes `cells[]` in place of (or in addition to) `points[]`, per `points=` toggle.
- `resolution` (optional, default `40`). Cell count per side for `grid`; approximate hex bin size for `hex`.
- `points` (optional, default `true` for backward compatibility). When `false`, `points[]` is empty/omitted.

**Response when `aggregated=hex`:**
```json
{
  "data": {
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

- `topic_ids` is **the crucial optional field**. If you can include it (top-K by count within the cell, K ≤ 5), request #3 becomes unnecessary — the client can jump straight to Topic Detail without another round-trip. If it's expensive to compute, omit it and we'll use request #3.
- `mean_velocity` and `mean_heat_percentile` let us colour by either dimension in 2D and extrude by either in 3D (see rendering notes below).
- `bounds` returned here supersedes the client's cached bounds if it differs — v1 says UMAP re-fits on process restart; we'll invalidate on bounds mismatch.

**Tier gating:** unchanged. `aggregated` works on both tiers with existing window/asof rules.

**Frontend rendering plan:**
- **2D (default)**: HeatmapLayer sourced from `cells[]` weights, radius derived from `cell_size`. Removes scatter entirely.
- **3D (opt-in)**: HexagonLayer with `extruded: true`, height ← `count`, colour ← `mean_heat_percentile` (opacity dimmed by confidence, same honesty rule). Camera on `OrbitView` for pitch/rotate. Same URL param `?view=3d`; state is shareable via the existing SHARE LINK button.
- The 3D toggle is a small chip next to Heat Field On/Off in the map toolbar. 2D is the default per your call. Same aggregated payload feeds both — no additional fetch to switch views.

---

## 3. `GET /v1/map/topics_at` — top topics inside a spatial region _(P1)_

**Surface:** `/map`. Only needed if request #2's `cells[]` doesn't already carry `topic_ids`. If it does, please skip this endpoint and note it in the response to us.

**Why v1 can't serve it:** We'd need to fetch raw points, filter client-side by (x, y, radius), and group by topic_id. That reintroduces the fat payload we're trying to eliminate in request #2.

**Proposal:**
```
GET /v1/map/topics_at?x=4.1&y=-2.3&radius=1.0&window=24h&asof=&limit=5
```

**Response:**
```json
{
  "data": [
    {
      "topic_id": 134,
      "name": "NBA 2K27 Gameplay Reviews",
      "sector": "gaming",
      "member_count_in_region": 12,
      "heat_percentile": 0.99,
      "heat_confidence": 0.72,
      "signals": { "velocity": 0.028, "acceleration": 0.011 }
    }
  ],
  "meta": { "..." : "..." }
}
```

**Tier:** Free. This is the "what topics are here" reveal; it's the entry into further investigation. Rate-limited same as `/v1/topics`.

---

## 4. `GET /v1/map/cluster_summary` — LLM read of a hot region _(P0 for the AI cluster feature; blocking that feature only)_

**Surface:** `/map`. Clicking a hex opens a side-panel with a natural-language description of "what this cluster represents", generated by an LLM over the top topics in that region. **Pro** users additionally see the topics list; **Free** users see summary + confidence only.

**Why we're asking you to own this, not building it Emergent-side:** the LLM call needs the topic centroids, names, summaries, and heat data you already hold. Doing it in an Emergent-hosted proxy would either (a) require you to expose more raw data to us, or (b) recreate a second stateful application over your API — which is exactly the pattern we've been careful to avoid (same logic that killed the alerts backlog). The clean fit is: derived intelligence over your data lives next to your data.

**Backend team, please decide and reply:** _which LLM provider / model do you want to use, and how should caching be handled?_ Suggestions from our end:
- **Model recommendation**: Claude Sonnet 4.6 or Gemini 3 Flash — both are fast, cheap, and good at short structured summarisation over lists.
- **Prompt shape**: given top 5 topics (name, summary, sector, heat_percentile, entities), return a single 1–2 sentence natural-language read + a coherence score (0..1) reflecting whether these topics genuinely cluster or are a coincidental spatial adjacency.
- **Caching**: aggressive — key on `(bucket_asof, quantised x/y/radius, window)`. A 15-minute TTL is fine; heat updates hourly so mid-hour re-clicks should hit the cache.
- **Cost gate**: cap regenerations per API key per hour (e.g., 30/hour Free, 200/hour Pro) so a runaway UI can't burn budget.

**Proposal:**
```
GET /v1/map/cluster_summary?x=4.1&y=-2.3&radius=1.0&window=24h&asof=&include=topics
```

**Response:**
```json
{
  "data": {
    "summary": "This region concentrates NBA 2K27 gameplay reviews, MyPLAYER build breakdowns, and Franchise Mode critiques — a single sports-gaming release event fanning out across creators.",
    "coherence": 0.82,
    "generated_at": "2026-08-22T21:05:00+00:00",
    "cache_hit": true,
    "topics": [
      {
        "topic_id": 134,
        "name": "NBA 2K27 Gameplay Reviews",
        "sector": "gaming",
        "heat_percentile": 0.99,
        "heat_confidence": 0.72,
        "member_count_in_region": 12
      }
    ]
  },
  "meta": { "..." : "..." }
}
```

- `coherence` is the honesty gate. **If the top topics in the region are semantically incoherent (embedding spread too high), please do NOT fabricate a story.** Return `summary: "This region isn't cohering into a single story right now."` with `coherence` below whatever threshold you pick (~0.5). Same discipline as heat_confidence — the UI treats low-coherence summaries as provisional the same way it treats low-confidence heat.
- `cache_hit` lets us surface staleness of the read to power users.

**Tier gating:** `include=topics` and the `topics[]` array are **Pro**. Free requesting `include=topics` returns **HTTP 402** with `detail = { "feature": "cluster investigation", "message": "..." }`, matching the existing 402 contract. Free users always get `summary`, `coherence`, `generated_at`, `cache_hit`.

**Frontend rendering plan:**
- Click a hex → open cluster side-panel → `useClusterSummary({ x, y, radius, window, asof, include: tier === 'pro' ? 'topics' : undefined })`.
- Coherence < 0.5 renders the summary with dimmed opacity and an explicit "this region isn't cohering" caveat.
- Pro topics list are hoverable rows linking to `/topic/:id`, with the existing HeatBadge + closeness derivable from `member_count_in_region`.
- 402 for Free `include=topics` renders as the standard `LockedFeature` for `"cluster investigation"`.

---

## Contract stability, still depended on

Nothing here breaks the invariants v1.1 established. We continue to depend on:

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
- Any per-URL dynamic OG rendering — we handle that client-side today by generating a downloadable PNG on the topic-focus flow. If a dynamic OG service ever ships on your side, the current SHARE LINK URLs are already OG-ready (`topic_id`, `window`, `asof` all live in query params).

## Rollout order I'd suggest

If your team wants to ship these in a specific order to unblock us fastest:

1. **Request 1** first — landing page is fully blocked without it and there is nothing to fall back on.
2. **Request 2** next — enables the 2D map redesign; without it, the redesign is a re-styling of the existing point payload.
3. **Request 4** third — the AI cluster feature is the most differentiated UX, but it lives inside the map, so shipping the map first with a "click a hex to see the topics inside" fallback is graceful degradation.
4. **Request 3** last — only if request 2 doesn't include `topic_ids`. If it does, delete this one.

We'll ship the frontend in two phases matching this — Phase A (landing) can go the moment request 1 is live; Phase B (map + AI) once requests 2 and 4 are ready.
