import React, { useMemo } from "react";
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
 * OrthographicView pins to the point cloud's bounding box so pan/zoom moves
 * *through* the same map, never rebasing it between windows.
 *
 * Props:
 *   points: MapPoint[]                — used only as heatmap weight source
 *   topics: Map<number, Topic>        — used for per-point velocity weighting
 *   showHeat: boolean                 — quick off-toggle for the heat layer
 *   bounds: { minX, maxX, minY, maxY } | null
 */
const OVIEW = new OrthographicView({ id: "ortho", controller: true });

export function MapCanvas({ points, topics, showHeat, bounds }) {
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
      // Positive velocity = accelerating attention. Give unclustered noise a
      // tiny baseline so quiet regions don't render as dead black holes but
      // clearly under-index against hot ones.
      const v = t ? Math.max(0, t.signals?.velocity || 0) : 0.005;
      return { position: [p.x, p.y], weight: v + 0.005 };
    });
  }, [points, topics, showHeat]);

  const layers = useMemo(() => {
    if (!showHeat || !heatData.length) return [];
    return [
      // Broad ambient layer — softer, wider, sets the atmosphere
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
      // Focused layer — smaller radius, higher contrast, defines the hot spots
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

  return (
    <DeckGL
      data-testid="map-canvas"
      views={OVIEW}
      initialViewState={initialViewState}
      controller={{ dragRotate: false, minZoom: 3, maxZoom: 12 }}
      layers={layers}
      style={{ position: "absolute", inset: 0, background: "#0a0d13" }}
      getCursor={({ isDragging }) => (isDragging ? "grabbing" : "grab")}
    />
  );
}
