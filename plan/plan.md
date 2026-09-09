# Mobile homepage performance plan

## The finding

The landing hero renders four expensive things at the same time on mobile:

1. **Three large radial-gradient orbs (380–520px each) with `blur-3xl`**, each running an infinite keyframe animation that drifts and pulses. CSS blur at that radius is heavy on phone GPUs and repaints every frame.
2. **A deck.gl WebGL scene** (HeatmapLayer × 2 — an atmosphere layer and a focus layer, each aggregating ~1,600 weighted points).
3. **A 220ms frame-swap timer** that rebuilds the heat data array and rewrites both layers' `data + updateTriggers`, forcing a full re-aggregation of the WebGL heatmap ~4.5× per second.
4. **The hero copy staggered fade + the post-load settle transform**, both running composite animations on the same frame budget.

Desktop absorbs it. Mobile GPUs throttle and drop frames — visibly.

## What to change

Four levers, ranked from safest/highest-impact to lower-priority. All are gated on a mobile viewport check (`matchMedia("(max-width: 640px)")`) so desktop is not affected.

### 1) Slow the timelapse frame cadence on mobile

Change the AmbientHeat frame interval from **220ms → 800ms** on mobile only. Loop reads as smooth ambient motion, not a per-frame update. 4.5 aggregations/sec becomes ~1.25/sec — the biggest single win.

### 2) Reduce heatmap work per frame on mobile

- Render **one heatmap layer instead of two** (drop the wide atmosphere pass, keep the focus pass with slightly larger `radiusPixels`).
- Drop the density-threshold filter so we feed fewer, higher-signal points.
- Cap the point count at ~600 (down from ~1,600).

Visually the hero still reads "warm map"; GPU work per aggregation roughly halves.

### 3) Freeze the fallback blooms on mobile

Keep the three radial gradients as static background art — remove the `hero-drift-a/b/c` animations on mobile via a media query. The blooms still look correct; they just stop repainting. This is a large paint-cost reduction because `blur(64px)` on a 520px element is expensive per frame.

### 4) Skip the settle transform on mobile

The post-load "heat drifts right, copy drifts left" is a desktop-only refinement — on a 390px viewport the copy already fills the column and the shift has no visual room to matter. Skipping it removes one more compositor transition on the same frame budget as the timelapse loop.

## The one call worth making

**How aggressive should mobile be?**

- **(A) Trim, don't strip** — apply all four levers above. The mobile hero still shows the real WebGL timelapse, just at a calmer cadence with fewer layers and no bloom animation. Reads as intentional ambient motion. Recommended.
- **(B) Strip the WebGL entirely on mobile** — replace the deck.gl hero with a single static pre-baked heatmap PNG (a snapshot of the current 24h field). Zero GPU cost. Loses the "it's alive" feel; gains guaranteed smoothness on very old phones. Recommended if (A) still ships lag on a low-end target device.
- **(C) Detect low-end devices** and switch between (A) and (B) at runtime using `navigator.hardwareConcurrency <= 4` or `navigator.deviceMemory <= 4`. Ships both code paths; more surface area to maintain.

## Assumptions

- The mobile breakpoint is the existing Tailwind `sm` boundary (640px). No new breakpoint introduced.
- Desktop behaviour and animations are unchanged.
- Prefers-reduced-motion continues to disable the drifting blooms and the copy fade — this plan does not weaken accessibility.
- The Clerk sign-in modal, region investigation panel, and topic-detail "open source" flow are not part of the mobile perf problem and are not modified.

## Success criteria

- Landing hero on a 390×844 viewport paints at ≥45fps sustained (measured via Performance devtools) instead of the current sub-30fps.
- No visible frame drops during the timelapse loop.
- Desktop hero is pixel-for-pixel and animation-for-animation identical to today.
