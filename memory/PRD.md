# Pulse — Product Requirements

## Original problem statement
Build the public web app for **Pulse**, a cross-platform trend intelligence product by Calescent Labs. The frontend is a production-quality React SPA with three surfaces:
1. **The Map** — 2D semantic heat map (deck.gl WebGL) with region investigation.
2. **Trending Now** — ranked topics with heat percentile, confidence, sentiment, sparklines.
3. **Topic Detail** — heat curve, sentiment trajectory, member content that jumps to source.

The app consumes an external live Calescent API (base URL + keys provided by user) and enforces Free/Pro tier gating by treating HTTP 402 responses as a UI locked-state. Absolute honesty in data (confidence + sample sizes always shown).

Platform positioning: **one-stop jump-in point for everyday internet surfers**, not a pro analytics dashboard.

## Architecture
- React SPA (CRA) · TailwindCSS · shadcn/ui · React Router v7 · TanStack Query
- deck.gl (`@deck.gl/react`, `@deck.gl/aggregation-layers`) for the WebGL map + timelapse
- Recharts for velocity arcs / radar closeness
- Clerk (`@clerk/clerk-react`) for authentication — publishable key only on the frontend
- Frontend-only repo; no local backend/DB — all data via external Calescent API

## Implemented
- **2026-02** Landing page hero with 7-day 4h-resolution WebGL timelapse loop (`AmbientHeat`) + code-split + prefetch + localStorage cache
- **2026-02** Staggered hero text fade-in animation tied to `onDataReady` from timelapse
- **2026-02** `/map` — 2D deck.gl heatmap with region investigation side-panel, mobile-safe hint chip
- **2026-02** `/trending` — search, filters, pagination, Free-tier blurring (top 3 unblurred)
- **2026-02** `/topic/:id` — velocity arcs, radar closeness, member content unblurred for Free tier
- **2026-02** Clerk sign-up/sign-in modal wired to all "coming with Pro" surfaces
- **2026-02** `pulseClient.js` appends Clerk `Authorization: Bearer` alongside `X-API-Key`
- **2026-02** Placeholder `/upgrade` route for future Stripe flow
- **2026-02** Mobile hero perf pass:
    - Single heatmap layer on mobile (drops the wide atmosphere pass)
    - Timelapse frame cadence 220ms → 800ms on mobile
    - Higher density threshold + 600-point cap on mobile (down from ~1,600)
    - Fallback blooms static on mobile (animation disabled via `@media (max-width: 640px)`)
    - Settle transform skipped on mobile for both heat + copy columns
    - Desktop behaviour pixel-identical

## Backlog / next
- **P0** Deployment readiness check (deployment_agent) — user requested; still pending
- **P1** Stripe subscription flow to replace `/upgrade` placeholder (needs keys + confirmation)
- **P2** Region radius slider on the map's region investigation panel (default 1.0)
- **P3** Free-tier "Pro launches soon" toast after successful sign-up
- **P3** Feature-scoped copy: lift the triggering feature to the top of the sign-up modal bullets

## Critical guardrails
- **Never overwrite `frontend/.env`** — targeted `search_replace` only. It holds live API keys.
- **Frontend-only Clerk** — only publishable key belongs here; secret keys never enter the SPA.
- The map data points are intentionally hidden in `MapCanvas.jsx` (heat-only render) to obfuscate that the current data source is YouTube-only.
- 402 responses trigger `LockedFeature` / `BlurredSection`, not error toasts.
- Do not re-introduce the 3D mesh terrain — user removed it deliberately.
