import React, { useCallback, useMemo, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { OrthographicView } from "@deck.gl/core";
import { HEATMAP_COLOR_RANGE, ageColor, velocityColor } from "../lib/heat";

/**
 * MapCanvas — deck.gl-backed semantic map.
 * The coordinate space is FIXED (see DATA_CONTRACT.md). We use an
 * OrthographicView pinned to the point cloud's bounding box so pan/zoom
 * moves *through* the same map, never rebasing it between windows.
 *
 * Props:
 *   points: MapPoint[]
 *   topics: Map<number, Topic>   (optional — used to colour by velocity)
 *   colorBy: 'age' | 'velocity'
 *   showHeat: boolean
 *   bounds: { minX, maxX, minY, maxY } | null  — pinned across time
 *   onHoverPoint: (point|null, x, y) => void
 *   onClickPoint: (point) => void
 */
const OVIEW = new OrthographicView({ id: "ortho", controller: true });

export function MapCanvas({
  points,
  topics,
  colorBy,
  showHeat,
  bounds,
  onHoverPoint,
  onClickPoint,
}) {
  const hoverRef = useRef(null);

  // Initial view: centre on the fixed bounds, scaled to fill.
  const initialViewState = useMemo(() => {
    if (!bounds) return { target: [0, 0, 0], zoom: 5 };
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return { target: [cx, cy, 0], zoom: 6 };
  }, [bounds]);

  const heatData = useMemo(() => {
    if (!showHeat || !points || !topics) return [];
    return points.map((p) => {
      const t = p.topic_id != null ? topics.get(p.topic_id) : null;
      const weight = t ? Math.max(0, t.signals?.velocity || 0) : 0.02;
      return { position: [p.x, p.y], weight };
    });
  }, [points, topics, showHeat]);

  const getColor = useCallback(
    (p) => {
      if (colorBy === "velocity") {
        const t = p.topic_id != null && topics ? topics.get(p.topic_id) : null;
        return velocityColor(t ? t.signals?.velocity || 0 : 0);
      }
      return ageColor(p.age_hours);
    },
    [colorBy, topics],
  );

  const layers = useMemo(() => {
    const out = [];
    if (showHeat && heatData.length) {
      out.push(
        new HeatmapLayer({
          id: "heat",
          data: heatData,
          getPosition: (d) => d.position,
          getWeight: (d) => d.weight,
          radiusPixels: 60,
          intensity: 1.4,
          threshold: 0.05,
          colorRange: HEATMAP_COLOR_RANGE,
          aggregation: "SUM",
          pickable: false,
        }),
      );
    }
    if (points && points.length) {
      out.push(
        new ScatterplotLayer({
          id: "points",
          data: points,
          getPosition: (d) => [d.x, d.y, 0],
          getFillColor: getColor,
          getRadius: (d) => 1.6 + Math.log10(Math.max(1, d.views || 1)) * 0.6,
          radiusUnits: "pixels",
          radiusMinPixels: 1.4,
          radiusMaxPixels: 8,
          stroked: false,
          pickable: true,
          opacity: 0.9,
          updateTriggers: { getFillColor: [colorBy, topics] },
        }),
      );
    }
    return out;
  }, [points, heatData, getColor, colorBy, topics, showHeat]);

  return (
    <DeckGL
      data-testid="map-canvas"
      views={OVIEW}
      initialViewState={initialViewState}
      controller={{ dragRotate: false, minZoom: 3, maxZoom: 12 }}
      layers={layers}
      style={{ position: "absolute", inset: 0, background: "#0a0d13" }}
      onHover={({ object, x, y }) => {
        hoverRef.current = object || null;
        onHoverPoint && onHoverPoint(object || null, x, y);
      }}
      onClick={({ object }) => {
        if (object && onClickPoint) onClickPoint(object);
      }}
      getCursor={({ isDragging }) => (isDragging ? "grabbing" : hoverRef.current ? "pointer" : "grab")}
    />
  );
}
