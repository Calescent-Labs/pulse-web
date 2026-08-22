# Pulse API — Frontend requests for v1.1

_From the Pulse web app team, 2026-02._

These are the additions we need the backend to consider so the frontend can serve the full experience described in `PRODUCT_BRIEF.md` and `DESIGN_BRIEF.md`. All items respect the read-only, derived-intelligence-only rule — nothing here asks for raw content, comment text, embeddings, or writes.

Each entry lists: **surface** using it, **why v1 can't serve it**, **proposed endpoint / params**, **response shape**, and **priority**.

Batched intentionally — implement in whichever order suits the pipeline.

---

## 1. Map — "Moment" mode

| | |
|---|---|
| **Surface** | The Map (`/`) |
| **Priority** | P1 — degrades a designed feature (in `DESIGN_BRIEF.md` as a mode toggle) |
| **Why v1 can't serve it** | `/v1/map` returns everything published in the window (cumulative). "Moment" needs only what was *actively moving* at `asof` — a sparser, sharper picture. That requires filtering points by their parent topic's instantaneous velocity, which the client can't derive from the cumulative payload. |
| **Proposal** | `GET /v1/map?mode=cumulative\|moment` — default `cumulative`. When `moment`, return only points whose parent topic's velocity at `asof` exceeds a server-decided threshold (or the top-N-by-velocity topics' members). |
| **Response** | Unchanged — same `points[]` envelope, smaller array. |
| **UI wiring** | The toggle is designed and reserved in the URL as `?mode=moment`. Currently hidden. |

---

## 2. Topic Detail — related topics (nearest neighbours)

| | |
|---|---|
| **Surface** | Topic Detail (`/topic/:id`) |
| **Priority** | P1 — Design Brief explicitly lists "Related topics (nearest neighbours) if available" |
| **Why v1 can't serve it** | Not derivable client-side without embeddings, which are intentionally out of scope. |
| **Proposal** | `GET /v1/topics/{topic_id}/neighbours?limit=6` |
| **Response** | ```json { "data": [ { "topic_id": 141, "name": "…", "sector": "…", "distance": 0.18, "heat_percentile": 0.87, "heat_confidence": 0.7 } ], "meta": { ... } } ``` |

---

## 3. Trending — text search across topics

| | |
|---|---|
| **Surface** | Trending Now (`/trending`) |
| **Priority** | P1 — with 50 active topics today the ranked feed is scannable, but search is a natural retention lever once names/entities grow. |
| **Why v1 can't serve it** | No text filter parameter on `/v1/topics`. |
| **Proposal** | `GET /v1/topics?q=<string>` — server-side match against `name`, `entities`, and optionally `summary`. Case-insensitive substring is fine for v1.1. |
| **Response** | Unchanged envelope, filtered `data[]`. |

---

## 4. Trending — filter by status and sentiment

| | |
|---|---|
| **Surface** | Trending Now |
| **Priority** | P2 |
| **Why v1 can't serve it** | Only `sector` and `min_confidence` are supported today; the design calls out the "divided audience" case (mean≈0, high polarisation) as a first-class thing worth surfacing, but it can't be filtered for. |
| **Proposal** | Add to `/v1/topics`: `status=emerging,peaking` (comma-separated), `sentiment=positive\|neutral\|negative\|divided`. `divided` = server-computed rule (`abs(mean) < 0.15 AND polarisation > 0.35`) so definitions stay consistent between backend and frontend. |
| **Response** | Unchanged envelope, filtered `data[]`. |

---

## 5. Map — filter points to one topic

| | |
|---|---|
| **Surface** | The Map — clicking a point currently opens a topic side-panel. The design would benefit from highlighting *just that topic's* points on the map without refetching all points. |
| **Priority** | P2 |
| **Proposal** | `GET /v1/map?topic_id=134` — returns only points whose `topic_id == 134`. Combines with `window` / `asof`. |
| **Response** | Unchanged envelope. |

---

## 6. Topics — pagination metadata

| | |
|---|---|
| **Surface** | Trending Now |
| **Priority** | P2 — cheap now, expensive to retrofit once corpus grows |
| **Why v1 can't serve it** | `/v1/topics` returns `data[]` but no way to know if more exist. Fine at 50 topics; painful at 5000. |
| **Proposal** | Add `meta.pagination = { total, limit, offset, has_more }` to `/v1/topics`. |
| **Response** | Envelope gains `meta.pagination`; existing fields untouched. |

---

## Explicit non-asks

Documenting so nobody wonders whether we forgot:

- **Raw content, comment text, embeddings** — out of scope by design; the API surfaces derived intelligence only.
- **Write endpoints** — the API is read-only. Any user state (bookmarks, alert rules, viewing history) belongs on whatever service ships alerts later; the frontend is intentionally stateless.
- **Alerts / notifications** — deferred entirely. If they ship, they belong next to the heat engine that already knows when acceleration crosses a threshold, not on top of the read-only API.

---

## Contract stability we're depending on

If any of these need to change, please version-bump; the frontend types are pinned to the current shapes and treat any additive field as optional.

- **Fixed coordinate space on `/v1/map`.** The whole time-scrubbing UX is built on the assumption that UMAP is fitted once per process, so re-projecting old points would change what "gaming lives here" means. We remember the first non-empty bounds we see and reuse them for every window/asof combination.
- **`heat_percentile` as a rank, not a distribution.** We render it as `P##` and never narrate percentile movement as drama, per your caveat.
- **Nulls are normal.** Every renderer treats null gracefully (no "null" strings, no interpolated gaps).
- **`meta.disclaimer` on every scored response.** We surface it verbatim in the persistent footer.
- **The 2026-08-22 series break.** Marked on any chart that spans it — the constant is at `src/lib/format.js` (`SERIES_BREAK_ISO`).
