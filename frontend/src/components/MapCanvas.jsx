import React, { useCallback, useMemo, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { OrthographicView } from "@deck.gl/core";
import { HEATMAP_COLOR_RANGE } from "../lib/heat";

/**
 * MapCanvas — deck.gl-backed semantic heat map.
 *
 * We render heat regions only, no individual signal dots. The point payload
 * still comes from /v1/map (weighted by parent topic velocity) but nothing
 * per-point is drawn — this is a rendering decision, not an API one.
 *
 * The coordinate space is FIXED per server process (see DATA_CONTRACT.md).
 *
 * Props:
 *   points, topics, showHeat, bounds — as before
 *   onBoundsChange({minX, maxX, minY, maxY}) — fires (debounced by parent)
 *     whenever the visible extent changes, so a companion panel can list the
 *     topics inside the current view.
 */
const OVIEW = new OrthographicView({ id: "ortho", controller: true });

export function MapCanvas({ points, topics, showHeat, bounds, onBoundsChange }) {
  const initialViewState = useMemo(() => {
    if (!bounds) return { target: [0, 0, 0], zoom: 5 };
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return { target: [cx, cy, 0], zoom: 6 };
  }, [bounds]);

  const heatData = useMemo(() => {
    if (!showHeat || !points || !points.length) return [];
    return points.map((p) => {
      const t = p.topic_id != null && topics ? topics.get(p.topic_id) : null;
      const v = t ? Math.max(0, t.signals?.velocity || 0) : 0.005;
      return { position: [p.x, p.y], weight: v + 0.005 };
    });
  }, [points, topics, showHeat]);

  const layers = useMemo(() => {
    if (!showHeat || !heatData.length) return [];
    return [
      new HeatmapLayer({
        id: "heat-atmosphere",
        data: heatData,
        getPosition: (d) => d.position,
        getWeight: (d) => d.weight,
        radiusPixels: 140,
        intensity: 1.1,
        threshold: 0.02,
        colorRange: HEATMAP_COLOR_RANGE,
        aggregation: "SUM",
        opacity: 0.55,
        pickable: false,
      }),
      new HeatmapLayer({
        id: "heat-focus",
        data: heatData,
        getPosition: (d) => d.position,
        getWeight: (d) => d.weight,
        radiusPixels: 70,
        intensity: 1.8,
        threshold: 0.06,
        colorRange: HEATMAP_COLOR_RANGE,
        aggregation: "SUM",
        opacity: 0.9,
        pickable: false,
      }),
    ];
  }, [heatData, showHeat]);

  // Report the actual rendered viewport bounds to the parent. We use
  // onAfterRender because it gives us the resolved viewport instance
  // (including any user pan/zoom), not just the raw viewState. Debounce
  // handled by the parent so we don't refilter the panel on every frame.
  const lastReportedRef = useRef("");
  const reportBounds = useCallback(
    ({ viewports }) => {
      if (!onBoundsChange) return;
      const vp = viewports && viewports[0];
      if (!vp) return;
      const [minX, maxY] = vp.unproject([0, 0]);
      const [maxX, minY] = vp.unproject([vp.width, vp.height]);
      // Cheap change-detection so we don't fire onAfterRender-driven updates
      // when nothing meaningful moved (still frames, tooltip repaints, etc.)
      const key = `${minX.toFixed(3)}|${maxX.toFixed(3)}|${minY.toFixed(3)}|${maxY.toFixed(3)}`;
      if (key === lastReportedRef.current) return;
      lastReportedRef.current = key;
      onBoundsChange({ minX, maxX, minY, maxY });
    },
    [onBoundsChange],
  );

  return (
    <DeckGL
      data-testid="map-canvas"
      views={OVIEW}
      initialViewState={initialViewState}
      controller={{ dragRotate: false, minZoom: 3, maxZoom: 12 }}
      layers={layers}
      style={{ position: "absolute", inset: 0, background: "#0a0d13" }}
      getCursor={({ isDragging }) => (isDragging ? "grabbing" : "grab")}
      onAfterRender={reportBounds}
    />
  );
}
