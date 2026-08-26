import React, { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { OrthographicView } from "@deck.gl/core";
import { useMapTimelapse } from "../lib/queries";
import { HEATMAP_COLOR_RANGE } from "../lib/heat";

const OVIEW = new OrthographicView({ id: "landing-ortho", controller: false });

/**
 * AmbientHeat — the landing hero's 7-day timelapse loop.
 *
 * Extracted into its own file so `React.lazy` can code-split all of
 * deck.gl / aggregation-layers out of the main LandingPage bundle. The
 * static fallback bloom lives in LandingPage now and paints while this
 * chunk downloads and the timelapse fetch completes.
 *
 * Consumes GET /v1/map/timelapse (4h resolution, 42-43 frames, ~11KB
 * gzipped). Each frame carries a normalised 0–1 density grid; we project
 * cell centres once from the returned bounds and swap the HeatmapLayer's
 * data per tick. Frame cadence: 220ms per frame ≈ 9s loop.
 */
export default function AmbientHeat({ settled = false, onDataReady }) {
  const q = useMapTimelapse({ days: 7, resolution: "4h", grid: 40 });
  const payload = q.data?.data;
  const frames = payload?.frames || [];
  const bounds = payload?.bounds || null;
  const gridSize = payload?.grid_size || 40;

  // Fire once the moment we have real frames to render. The parent uses
  // this to trigger the settle animation (heat drifts right, copy left)
  // ONLY after the timelapse has actually painted — not on a fixed timer.
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (notifiedRef.current) return;
    if (!frames.length) return;
    notifiedRef.current = true;
    if (typeof onDataReady === "function") onDataReady();
  }, [frames.length, onDataReady]);

  // Precomputed cell centres — coordinate space is fixed across frames,
  // so we only need to compute this once per timelapse payload.
  const cellCentres = useMemo(() => {
    if (!bounds) return null;
    const cellW = (bounds.maxX - bounds.minX) / gridSize;
    const cellH = (bounds.maxY - bounds.minY) / gridSize;
    const centres = new Array(gridSize);
    for (let y = 0; y < gridSize; y++) {
      centres[y] = new Array(gridSize);
      for (let x = 0; x < gridSize; x++) {
        centres[y][x] = [bounds.minX + (x + 0.5) * cellW, bounds.minY + (y + 0.5) * cellH];
      }
    }
    return { centres, cellW, cellH };
  }, [bounds, gridSize]);

  const [frameIdx, setFrameIdx] = useState(0);
  useEffect(() => {
    if (!frames.length) return;
    const id = setInterval(() => {
      setFrameIdx((i) => (i + 1) % frames.length);
    }, 220);
    return () => clearInterval(id);
  }, [frames.length]);

  // Convert current frame's 2D density grid → weighted points for the layer.
  const heatData = useMemo(() => {
    if (!frames.length || !cellCentres) return [];
    const frame = frames[frameIdx] || frames[0];
    const cells = frame.cells || [];
    const out = [];
    for (let y = 0; y < cells.length; y++) {
      const row = cells[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x++) {
        const w = row[x];
        if (!w || w < 0.02) continue;
        const c = cellCentres.centres[y]?.[x];
        if (c) out.push({ position: c, weight: w });
      }
    }
    return out;
  }, [frames, frameIdx, cellCentres]);

  const initialViewState = useMemo(() => {
    if (!bounds) return { target: [0, 0, 0], zoom: 5 };
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return { target: [cx, cy, 0], zoom: 5.4 };
  }, [bounds]);

  const layers = useMemo(() => {
    if (!heatData.length) return [];
    return [
      new HeatmapLayer({
        id: "hero-atmosphere",
        data: heatData,
        getPosition: (d) => d.position,
        getWeight: (d) => d.weight,
        radiusPixels: 220,
        intensity: 1.0,
        threshold: 0.02,
        colorRange: HEATMAP_COLOR_RANGE,
        aggregation: "SUM",
        opacity: 0.45,
        pickable: false,
        updateTriggers: { getWeight: [frameIdx], getPosition: [frameIdx] },
      }),
      new HeatmapLayer({
        id: "hero-focus",
        data: heatData,
        getPosition: (d) => d.position,
        getWeight: (d) => d.weight,
        radiusPixels: 110,
        intensity: 1.7,
        threshold: 0.06,
        colorRange: HEATMAP_COLOR_RANGE,
        aggregation: "SUM",
        opacity: 0.9,
        pickable: false,
        updateTriggers: { getWeight: [frameIdx], getPosition: [frameIdx] },
      }),
    ];
  }, [heatData, frameIdx]);

  const currentFrame = frames[frameIdx];
  const frameStamp = currentFrame?.asof;

  return (
    <div
      data-testid="ambient-heat"
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      {/* Animated heat visual — shifts right after settle so the copy
          column clears. Vignettes + watermark stay put. */}
      <div
        className={`absolute inset-0 transition-transform duration-[1600ms] ease-out transition-opacity duration-1000 ${
          heatData.length ? "opacity-100" : "opacity-0"
        }`}
        style={{
          transform: settled ? "translate3d(11%, 0, 0)" : "translate3d(0, 0, 0)",
          willChange: "transform",
        }}
      >
        <DeckGL
          views={OVIEW}
          initialViewState={initialViewState}
          controller={false}
          layers={layers}
          style={{ position: "absolute", inset: 0 }}
        />
      </div>

      {/* Vignette so foreground copy stays legible */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(14,17,23,0.85) 0%, rgba(14,17,23,0.55) 40%, rgba(14,17,23,0.15) 70%, rgba(14,17,23,0.55) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(14,17,23,0.35) 0%, rgba(14,17,23,0) 30%, rgba(14,17,23,0) 65%, rgba(14,17,23,0.7) 100%)",
        }}
      />

      {/* Timelapse watermark — barely there, mono, corner-anchored. */}
      {frames.length > 0 && frameStamp && (
        <div
          data-testid="timelapse-stamp"
          className="pointer-events-none absolute bottom-4 right-4 z-[5] rounded-sm border hairline bg-background/50 px-2 py-1 mono text-[9px] uppercase tracking-[0.24em] text-neutral-400 backdrop-blur"
        >
          <span className="text-[hsl(25,95%,60%)]">◉</span>{" "}
          <span className="text-neutral-300">timelapse</span>{" "}
          <span className="text-neutral-500">·</span>{" "}
          {new Date(frameStamp).toISOString().replace("T", " ").slice(0, 13)}h UTC
          <span className="text-neutral-500">
            {" "}
            · frame {frameIdx + 1}/{frames.length}
          </span>
        </div>
      )}
    </div>
  );
}
