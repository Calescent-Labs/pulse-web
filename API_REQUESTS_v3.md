# Backend requests — v3 (historical topics for the map's Signals Panel)

**Context**
The frontend Signals Panel — the "trending here" list on the right side of the map — is fed by joining the map's returned points against `/v1/topics`. When a user picks a past `asof` via the moment picker (e.g. `2026-07-18T12:00:00Z`), the map correctly returns points for that moment, but `/v1/topics` still returns today's top-100. Any point whose `topic_id` was hot then but isn't ranked today lands in the panel as an unnamed `Topic #N` row.

**Ask**
Accept `asof` (and optionally `window`) on `GET /v1/topics` so it returns the topic ranking as-of that instant. Behaviour we'd like:

```
GET /v1/topics?asof=2026-07-18T12:00:00Z&window=72h&limit=100
  → 200 with topics ranked by their heat percentile inside the window
    ending at asof, with `name`, `sector`, `status`, `heat_percentile`,
    and `heat_confidence` all reflecting that historical moment.
```

**Current server behaviour we probed on 2026-02-09**
Passing `asof` and `window` to `/v1/topics` returns an identical response to the no-param call — confirmed by comparing the top-5 topic IDs across three variants of the same request. The server is silently ignoring the params.

**Frontend behaviour today (already shipped)**
Until the API supports the above, the panel:
- Surfaces unnamed rows as `Topic #<id>` with the accurate `count in view` so nothing is silently dropped.
- Shows an amber "historical naming caveat" banner at the top of the list explaining that names reflect today's ranking.
- Suppresses per-row `heat percentile · confidence` numbers in historical mode (they'd be misleading "current" numbers, not "then" numbers). Replaced with `heat then · —` placeholder.

**Cost / effort estimate for the frontend swap-in**
Trivial once the endpoint honours `asof`: pass `asof` and `window` through the existing `useTopics` hook (already parameterised) and drop the `isHistoricalMoment` flag propagation. Estimated ~30 min including verifying the new response shape.

**Nice-to-haves (not blockers)**
- A `historical: true` flag on the response so the client can still show a lighter caveat ("this is a reconstruction") if you can't guarantee 100% parity with the live ranking.
- If not every historical hour is materialised, respond with `note: "…"` and the closest bucket you do have, same pattern as `/v1/map` already uses.
