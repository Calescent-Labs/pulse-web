import React, { useCallback, useMemo, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { OrthographicView } from "@deck.gl/core";
import { HEATMAP_COLOR_RANGE } from "../lib/heat";

/**
 * MapCanvas — deck.gl-backed semantic heat map.
 *
 * Heat regions only, no per-signal dots — except an OUTLINE layer that
 * lights up when the parent hovers a row in the signals panel. That
 * outline is per-topic point positions, drawn as thin stroked rings so
 * the geography of a topic is legible on hover without leaking channel
 * or platform names.
 */
const OVIEW = new OrthographicView({ id: "ortho", controller: true });

export function MapCanvas({
  points,
  topics,
  showHeat,
  bounds,
  onBoundsChange,
  hoveredTopicId,
  onHighlightScreen,
}) {
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

  // Points belonging to the hovered topic — drawn as outlined rings so the
  // geography lights up without exposing per-point content.
  const highlightPoints = useMemo(() => {
    if (hoveredTopicId == null || !points || !points.length) return [];
    return points.filter((p) => p.topic_id === hoveredTopicId);
  }, [points, hoveredTopicId]);

  const layers = useMemo(() => {
    const out = [];
    if (showHeat && heatData.length) {
      out.push(
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
      );
    }
    if (highlightPoints.length) {
      // Faint fill for volume + bright stroked ring for clarity.
      out.push(
        new ScatterplotLayer({
          id: "topic-highlight-fill",
          data: highlightPoints,
          getPosition: (d) => [d.x, d.y, 0],
          getFillColor: [255, 200, 90, 90],
          getRadius: 4,
          radiusUnits: "pixels",
          stroked: false,
          pickable: false,
          opacity: 0.9,
        }),
        new ScatterplotLayer({
          id: "topic-highlight-ring",
          data: highlightPoints,
          getPosition: (d) => [d.x, d.y, 0],
          getFillColor: [0, 0, 0, 0],
          getLineColor: [255, 235, 140, 240],
          getRadius: 6,
          radiusUnits: "pixels",
          getLineWidth: 1.4,
          lineWidthUnits: "pixels",
          stroked: true,
          filled: true,
          pickable: false,
          opacity: 1,
          updateTriggers: { getPosition: [hoveredTopicId] },
        }),
      );
    }
    return out;
  }, [heatData, highlightPoints, showHeat, hoveredTopicId]);

  // World-space centroid of the highlighted topic's points, computed once
  // per highlight change. Screen projection happens per-frame in onAfterRender
  // so it stays correct as the user pans/zooms.
  const highlightCentroid = useMemo(() => {
    if (!highlightPoints.length) return null;
    let sx = 0, sy = 0;
    for (const p of highlightPoints) {
      sx += p.x;
      sy += p.y;
    }
    return [sx / highlightPoints.length, sy / highlightPoints.length];
  }, [highlightPoints]);

  const lastReportedRef = useRef("");
  const lastCentroidKeyRef = useRef("");
  const reportBounds = useCallback(
    ({ viewports }) => {
      const vp = viewports && viewports[0];
      if (!vp) return;

      // Project highlight centroid to screen coordinates, fire callback.
      if (onHighlightScreen) {
        if (highlightCentroid) {
          const [sx, sy] = vp.project([highlightCentroid[0], highlightCentroid[1], 0]);
          const key = `${sx.toFixed(1)}|${sy.toFixed(1)}`;
          if (key !== lastCentroidKeyRef.current) {
            lastCentroidKeyRef.current = key;
            onHighlightScreen({ x: sx, y: sy });
          }
        } else if (lastCentroidKeyRef.current !== "") {
          lastCentroidKeyRef.current = "";
          onHighlightScreen(null);
        }
      }

      if (!onBoundsChange) return;
      const [minX, maxY] = vp.unproject([0, 0]);
      const [maxX, minY] = vp.unproject([vp.width, vp.height]);
      const key = `${minX.toFixed(3)}|${maxX.toFixed(3)}|${minY.toFixed(3)}|${maxY.toFixed(3)}`;
      if (key === lastReportedRef.current) return;
      lastReportedRef.current = key;
      onBoundsChange({ minX, maxX, minY, maxY });
    },
    [onBoundsChange, onHighlightScreen, highlightCentroid],
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
