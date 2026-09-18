# Pulse frontend containment compatibility

Prepared against Calescent-Labs/pulse-web main commit
35c9123ab519075d1e9151022036bfb59eb6f20a.
Status: proposed frontend branch; no merge or deployment.
Repository write access is now available. Automated test/build verification
runs through the frontend compatibility workflow.

## Findings from the repository

1. frontend/src/lib/pulseClient.js maps all HTTP 503 responses to a generic
   degraded error and discards the containment reason.
2. frontend/src/lib/queries.js persists the hero timelapse under
   pulse:timelapse:v1 in localStorage, with a one-hour cache lifetime, and
   restores that data before a network check. Map/topic queries also retain
   previous results in memory. A backend pause alone does not remove them.
3. frontend/public/index.html prefetches historical data before React starts.
4. frontend/src/components/AppShell.jsx infers live/stale from heat age.
   Process health alone does not mean analytical data is available.
5. LandingPage.jsx independently labels the hero live and renders historical
   AmbientHeat frames. TopicDetailPage.jsx renders historical charts and
   outbound member links; these must not mount during containment.
6. Clerk sign-in lives outside the analytical API, and the /upgrade route is
   separate. Keeping those components mounted preserves their wiring; actual
   sign-in still needs an authenticated Emergent preview smoke test.

The read-only VM inventory does not change the website. Deploying the backend
pause does affect its data surfaces. No data cleanup is performed in Release A.

## Implemented local changes

- A shared availability boundary checks public health before mounting data
  pages. Legacy healthy responses remain compatible.
- On health data_available=false or a recognized containment 503, replace
  the analytical routes with a branded availability page using the existing
  AppShell. Home, map, trending and topic URLs stay navigable.
- Retain the /upgrade route, navigation and Clerk providers. No sign-in,
  entitlement or payment contract is changed.
- Unmount data surfaces and cancel/remove analytical React Query results.
  Preserve health/account caches.
- Remove persistent historical caching and the HTML prefetch bypass.
  Delete the legacy timelapse key when the new app mounts or detects a pause.
- Discard in-flight analytical responses arriving after the pause.
- Mark the header data paused instead of stale/live.
- Use no-store API requests. Health requests bypass token retrieval, time
  out after 10 seconds and refresh every minute/on focus.
- Keep ordinary 401/402/404/429 and unrelated 503 errors distinct from
  containment. The session pause is latched; Check again reloads the page.
- Include tests and an optional GitHub Actions test/build workflow.

During containment the homepage temporarily becomes a simple branded product
introduction and availability notice. It does not retain the animated hero,
topic cards, current-coverage claims or fabricated sample heat. This is an
intentional visible product change to review in the preview.

## Complete files

This change contains complete replacement/new files, not snippets. Apply to a
review branch, comparing against the base commit above. It is not a complete
standalone checkout. Do not overwrite intervening Emergent changes blindly.
Do not replace configuration files or share secrets.

Changed existing files:

- frontend/src/App.js
- frontend/src/components/AppShell.jsx
- frontend/src/lib/pulseClient.js
- frontend/src/lib/queries.js
- frontend/public/index.html

New files:

- frontend/src/lib/dataAvailability.js
- frontend/src/components/DataAvailabilityBoundary.jsx
- frontend/src/lib/containment.test.js
- frontend/src/components/DataAvailabilityBoundary.test.jsx
- frontend/src/setupTests.js
- tests/containment-client.test.cjs
- .github/workflows/frontend-containment.yml
- this handoff document

## Validation status

Six dependency-free tests passed locally against the actual client and
availability modules:

```bash
node --experimental-vm-modules --test tests/containment-client.test.cjs
```

Check the frontend compatibility workflow for the React/Jest and production
build results on the exact proposed commit. Browser visual checks and real
Clerk sign-in in Emergent remain deployment gates even after that workflow passes.
Do not describe this change as verified on the live deployment.

In Emergent's existing frontend environment, run:

```bash
cd frontend
CI=true yarn test --watchAll=false --runInBand --resolver=./jest-router-resolver.cjs --testPathPattern='containment.test|DataAvailabilityBoundary.test'
yarn build
```

If dependencies must be installed, use the established Emergent installation
process. No frontend/yarn.lock was available in the reviewed repository, so
the included workflow resolves dependencies at run time; reproducible dependency
locking is a separate follow-up. Build warnings must be reviewed. The workflow
allows existing lint warnings during its build and does not deploy anything.

## Required preview scenarios before the backend pause

Use mocked responses in a private preview; do not change the production API
to conduct this test.

| Scenario | Expected result |
| --- | --- |
| Legacy health status=ok, normal data | Existing data pages work |
| New health status=ok, data_available=false | Branded unavailable view, no data components |
| Analytics containment 503 while health is old | Global pause, cached data removed |
| Old localStorage timelapse and seeded in-memory results | No old heat/cards after pause |
| Late successful request after pause | Discarded, never restores content |
| /map with historical timestamp, /trending, /topic/123 | Working navigation, availability notice |
| Health outage/timeout | Connection notice, no endless loading |
| /upgrade and Clerk modal | Account route and actual sign-in remain usable |
| Desktop/mobile | Readable notice and usable navigation |
| Ordinary 404 after later cleanup | Existing topic-not-found handling, no crash |

The boundary intentionally pauses all current analytical views because the
backend release pauses all shared legacy analytics. Selective source/history
availability requires a future explicit contract; this is not that redesign.

## Rollout order

1. Apply these changes in a frontend review branch or Emergent preview.
2. Run tests/build and the preview matrix. Confirm the deployed Emergent
   app is actually sourced from this repository/commit; repo access does not
   establish what is currently hosted.
3. Deploy the verified frontend first while the old API is still healthy.
   Check normal navigation and sign-in, then confirm reviewers get the new
   build on refresh.
4. Run/review the sanitized VM inventory, then deploy the backend pause using
   the staged backend procedure. The inventory itself is safe for the site.
5. Verify actual live health/503 responses and the live browser's unavailable
   state. Ask reviewers to refresh already-open tabs.
6. Only then plan historical-data lifecycle cleanup separately.

Already-open tabs running an older JavaScript build cannot be patched by
publishing a new one. Review any hosting/CDN/service-worker caching in Emergent;
these were not inspected. Health polling can take up to a minute in an active
new-build tab, and background tabs may be throttled. This is not an immediate
global revocation mechanism for data already sent to browsers.

Static screenshots/social previews, external model providers, cloud object
copies and other data stores are not purged by this frontend patch.
No rollback should restore old frontend cached analytics after backend
containment. Keep a tested unavailable view while fixing any deployment issue.
