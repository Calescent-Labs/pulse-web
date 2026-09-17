# Public GitHub README for the Pulse frontend repo

## Goal
Prepare a single `README.md` at the repository root that presents Pulse as a polished public project while keeping every secret, endpoint, and internal detail out of the repo. The README is the entire deliverable — no code changes, no new folders elsewhere.

## What the README will cover

1. **Hero block** — product name, one-line pitch ("The internet, before it's obvious."), a badge row (status: in active development · frontend: React + deck.gl · data: private API).
2. **Screenshots** — two embedded images:
   - Landing page hero showing the live 7-day heat timelapse.
   - Interactive heat map page (`/map`) with a region investigation panel open.
   Both are static PNGs committed to `docs/screenshots/`. No animated captures — a GIF of the timelapse is optional and covered below as a decision point.
3. **What Pulse does** — three short bullets in plain language: scan, discover, jump in. Mirrors the on-site copy so the repo and product tell the same story.
4. **Current state / roadmap note** — explicit line: *"Pulse is growing. We are actively training and refining data models on the live heat signal so the platform reads the internet more accurately and much faster over time."* Framed as forward momentum, not as "unfinished."
5. **Architecture note** — one paragraph making it unambiguous that this repository is **the frontend only**. The backend, data ingestion, model training, and API infrastructure live in a **separate private repository**. No backend URLs, endpoint paths, or auth provider identifiers are named.
6. **Tech stack** — plain list (React, Tailwind, shadcn/ui, deck.gl, TanStack Query, Recharts). Auth and API provider names are omitted so nothing in the README points a curious visitor at internal infra.
7. **Running locally** — a short block noting the app requires environment variables that are **not distributed with the repo** and are obtained from the maintainers. No example `.env` file is committed. Any placeholder values shown are obvious dummies (`your_key_here`).
8. **Contributing** — a one-liner: this is a showcase repository; issues welcome, PRs by invitation.
9. **License + credits** — MIT or "All rights reserved" (decision point below), plus a "Built by Calescent Labs" credit line.

## Public-safety pass (non-negotiable)

The README is the visible surface, but a public repo exposes the whole tree. Before the repo goes public these checks must pass — the README will explicitly document that they were done:

- **No `.env`, `.env.local`, or `.env.production` committed.** `.gitignore` must cover them; if any were ever committed historically, `git filter-repo` / a fresh squashed history is required before making the repo public.
- **No API base URLs, backend hostnames, provider dashboard URLs, or account IDs in source.** The client reads them all from env at runtime.
- **No Clerk publishable key hardcoded** — even though publishable keys are technically safe to expose, they identify the auth tenant and are treated as internal here.
- **No `test_credentials.md`, no `/app/memory/*`, no `test_reports/*`, no `.emergent/` folder** pushed to the public remote. These are internal-only.
- **No screenshots that show a signed-in user's email, real content titles that could dox creators, or the raw dot-level map view.** Only the heat-aggregate view is shown.

Everything above will be listed in the README under a short "Security posture" section so a reviewer can see at a glance that the repo was audited before going public.

## Decisions the user needs to make

**D1 — License.**
  - (a) **MIT** — permissive, standard for showcase repos, invites forks.
  - (b) **All rights reserved / source-available** — code is viewable but not reusable. **Recommended if the frontend embodies proprietary product design.**
  - (c) **Apache 2.0** — like MIT but with an explicit patent grant.

**D2 — Timelapse GIF.**
  - (a) **Two static screenshots only** — smallest repo footprint, README loads instantly. **Recommended.**
  - (b) **Add a short animated GIF of the timelapse** (≤ 2 MB, ≤ 6 seconds, cropped to the hero) so the moving field is visible to visitors who won't click through to the live site.

**D3 — How prominently to name the API provider on the map page.**
  - (a) **Do not name it at all** — README describes "the live Pulse data feed" and "a private backend." Matches how the site currently frames its data.
  - (b) **Name it as "Calescent API (private)"** — clearer for anyone who already knows the company.

**D4 — Contact / lead capture.**
  - (a) **No contact block.**
  - (b) **A one-line email or form link** for people who land on the repo curious about access. **Useful if the repo is expected to attract inbound.**

## Assumptions (recorded, will not be re-asked)

- The public GitHub repository will be the current `/app/frontend/` tree only — the top-level `/app` folder, `/app/backend/`, `/app/memory/`, and `/app/test_reports/` are not part of the push.
- Screenshots will be captured from the live preview URL against the current styling. Any framing (device chrome, drop shadow) is a light presentation touch and does not need approval per screenshot.
- The README targets a technical-but-general audience: hiring managers, prospective collaborators, journalists writing about the product. Not other engineers looking to fork.
- "Emergent does not reveal any keys or details" is interpreted as: no runtime env values, no internal service URLs, no build-tool identifiers, and no fork/preview URLs appear in the committed files or the README text.

## What is out of scope

- Reorganising the repository structure.
- Splitting existing files or renaming folders.
- Adding CI, deploy scripts, or GitHub Actions.
- Writing a `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, or issue templates.
- Any actual `git` remote configuration, publishing, or making the repo public — the plan produces the README and the safety checklist; the push itself is the user's action.
