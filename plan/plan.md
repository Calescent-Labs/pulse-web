# Mobile hero — round 2: granularity + residual lag

## What's happening

Two symptoms after the round-one pass:

1. **The timelapse looks granular** — individual heat cells are visible instead of a continuous warm field.
2. **Playback still lags slightly** on the mobile device being tested.

Both symptoms trace back to the same root cause: **the mobile hero is rendering the same coordinate frame as desktop at the same zoom (5.4), but a 390px viewport sees ~4× less horizontal world than a 1440px viewport.** Each heat cell paints proportionally larger on-screen, which (a) reveals the underlying grid, and (b) means the fragment shader is doing more per-pixel work per frame — the exact loop the frame timer is racing.

Round one reduced *work per frame* (single layer, fewer points, slower cadence). Round two reduces *pixels affected per point* and *frames per loop* — a different axis, compounds with round one.

## What to change

Four levers. All still gated on `(max-width: 640px)`; desktop remains untouched.

### 1) Zoom the mobile hero out

Drop `zoom` from **5.4 → 4.6** on mobile only. Same bounds, wider view. Each cell shrinks on screen, the field reads as continuous heat instead of a dot pattern, and the fragment shader touches far fewer pixels per point. This is the primary fix for the granularity complaint and also the biggest remaining perf win.

### 2) Add back a soft, wide, low-cost smoothing pass

The round-one plan dropped the wide atmosphere layer entirely. That's why gaps between hot cells now read as "individual dots." Add back a **single** wide-radius pass at very low opacity — but only 300 of the top points, radius 260, opacity 0.28. It's cheaper than the original atmosphere layer (fewer points, same-or-lower opacity) and it fills the gaps so the focus pass reads as glow rather than dots.

Net mobile layer count: **2 layers, ~900 points total** (600 focus + 300 smoothing). Round one was 1 layer / 600 points. Desktop stays at 2 layers / ~1,600 points.

### 3) Slow the frame cadence further

Bump the mobile interval from **800ms → 1,200ms**. Loop period grows from ~34s to ~52s (42 frames), reads as slow ambient drift rather than a slideshow. Cuts re-aggregations another 33%.

### 4) Skip every other frame in the mobile loop

Rather than iterating every frame in the payload, iterate `frameIdx += 2` on mobile. Combined with lever 3 this yields ~21 GPU aggregations per full ambient cycle instead of the current ~42. The visual difference is imperceptible because 4-hour frames are already coarse.

## The one call worth making

**How far to zoom out.**

- **(A) Moderate — zoom 4.6** — heat still fills most of the viewport, feels present behind the copy. Reads as "warm ambient map." **Recommended.**
- **(B) Aggressive — zoom 4.2** — heat clearly clusters as a small warm patch rather than filling the frame. Almost no granularity possible; also the cheapest to render. Pick this only if (A) still lags on the target device.
- **(C) Adaptive** — start at 4.6, drop to 4.2 if `navigator.hardwareConcurrency <= 4`. More surface area to maintain and only helps a narrow band of devices.

## Assumptions

- The lag report is from a real mobile device (not devtools throttling), so the fix targets actual GPU/fragment cost, not JS work.
- The user cares more about "no individual dots visible" than about "heat covers the whole hero" — so a slightly zoomed-out framing is acceptable.
- Frame count from the API stays at ~42 frames × 4h. Skipping every other frame is a client-side decision only.
- Desktop hero behaviour, cadence, layer count, and framing are unchanged.

## Success criteria

- On the tested mobile device, the timelapse loop reads as a continuous warm field — no discrete cells visible at rest.
- Sustained ≥50fps on the hero at 390×844.
- Desktop hero remains pixel- and animation-identical to today.
