import React, { useCallback, useMemo, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer, ColumnLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { OrthographicView, OrbitView } from "@deck.gl/core";
import { HEATMAP_COLOR_RANGE, heatColor } from "../lib/heat";

/**
 * MapCanvas — deck.gl-backed semantic map.
 *
 * 2D mode (default): heat regions only, no per-signal dots, plus a
 * per-topic outline layer that lights up on signals-panel hover so
 * a topic's geography is legible without leaking channel or platform
 * names. Clicking anywhere fires `onRegionClick({ x, y })` which the
 * parent uses to open the region investigation panel.
 *
 * 3D mode: rendered from server-aggregated `cells[]` (via
 * `/v1/map?aggregated=hex&points=false`). Each cell becomes an extruded
 * hex column — height driven by `mean_velocity`, colour by velocity
 * ramp. Clicking a hex fires `onRegionClick({ x, y })` with the cell's
 * centre so the region panel picks up exact counts for that spot.
 */
const OVIEW = new OrthographicView({ id: "ortho", controller: true });
const ORBIT = new OrbitView({ id: "orbit", controller: true, orbitAxis: "Z", fov: 50 });

export function MapCanvas({
  view = "2d",
  points,
  cells,
  cellSize,
  topics,
  showHeat,
  bounds,
  onBoundsChange,
  hoveredTopicId,
  onHighlightScreen,
  onRegionClick,
}) {
  const is3D = view === "3d";

  const initialViewState = useMemo(() => {
    if (!bounds) {
      return is3D
        ? { target: [0, 0, 0], rotationX: 55, rotationOrbit: 20, zoom: 5 }
        : { target: [0, 0, 0], zoom: 5 };
    }
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return is3D
      ? { target: [cx, cy, 0], rotationX: 55, rotationOrbit: 20, zoom: 5.4 }
      : { target: [cx, cy, 0], zoom: 6 };
  }, [bounds, is3D]);

  const heatData = useMemo(() => {
    if (is3D || !showHeat || !points || !points.length) return [];
    return points.map((p) => {
      const t = p.topic_id != null && topics ? topics.get(p.topic_id) : null;
      const v = t ? Math.max(0, t.signals?.velocity || 0) : 0.005;
      return { position: [p.x, p.y], weight: v + 0.005 };
    });
  }, [points, topics, showHeat, is3D]);

  // Points belonging to the hovered topic — drawn as outlined rings so the
  // geography lights up without exposing per-point content.
  const highlightPoints = useMemo(() => {
    if (is3D || hoveredTopicId == null || !points || !points.length) return [];
    return points.filter((p) => p.topic_id === hoveredTopicId);
  }, [points, hoveredTopicId, is3D]);

  // Velocity range across cells (for extrusion + colour normalisation).
  const cellStats = useMemo(() => {
    if (!cells || !cells.length) return { maxV: 0.05, maxCount: 1 };
    let maxV = 0.001, maxCount = 1;
    for (const c of cells) {
      if (c.mean_velocity > maxV) maxV = c.mean_velocity;
      if (c.count > maxCount) maxCount = c.count;
    }
    return { maxV, maxCount };
  }, [cells]);

  const layers = useMemo(() => {
    const out = [];

    if (is3D) {
      if (cells && cells.length && cellSize) {
        // Extruded hex columns — height = velocity, colour = velocity ramp
        // normalised against the frame's own peak (so ramp uses the full range).
        const radius = (cellSize / 2) * 1.1;
        const maxV = cellStats.maxV || 1;
        out.push(
          new ColumnLayer({
            id: "hex-3d",
            data: cells,
            diskResolution: 6,
            radius,
            extruded: true,
            elevationScale: 12,
            getPosition: (d) => [d.x, d.y, 0],
            getElevation: (d) => Math.max(0.02, (d.mean_velocity || 0) / maxV),
            getFillColor: (d) => {
              // Reuse the 0..1 heat ramp against per-frame max so colour tracks
              // relative intensity, not absolute velocity magnitude.
              const norm = Math.max(0, Math.min(1, (d.mean_velocity || 0) / maxV));
              const [r, g, b] = heatColor(norm);
              return [r, g, b, 235];
            },
            pickable: true,
            opacity: 0.95,
            material: { ambient: 0.55, diffuse: 0.75, shininess: 24 },
            onClick: (info) => {
              if (info?.object && onRegionClick) {
                onRegionClick({ x: info.object.x, y: info.object.y, radius: cellSize * 0.9 });
              }
            },
          }),
        );
      }
      return out;
    }

    // 2D
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
  }, [is3D, heatData, highlightPoints, showHeat, hoveredTopicId, cells, cellSize, cellStats, onRegionClick]);

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
      if (is3D) return; // OrbitView bounds are perspective-warped; skip.
      const [minX, maxY] = vp.unproject([0, 0]);
      const [maxX, minY] = vp.unproject([vp.width, vp.height]);
      const key = `${minX.toFixed(3)}|${maxX.toFixed(3)}|${minY.toFixed(3)}|${maxY.toFixed(3)}`;
      if (key === lastReportedRef.current) return;
      lastReportedRef.current = key;
      onBoundsChange({ minX, maxX, minY, maxY });
    },
    [onBoundsChange, onHighlightScreen, highlightCentroid, is3D],
  );

  // Click-to-investigate in 2D. In 3D the ColumnLayer's onClick handles it.
  const onCanvasClick = useCallback(
    (info) => {
      if (is3D) return; // handled by layer onClick
      if (!onRegionClick) return;
      if (!info || !info.coordinate) return;
      const [x, y] = info.coordinate;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      onRegionClick({ x, y, radius: 1.0 });
    },
    [is3D, onRegionClick],
  );

  return (
    <DeckGL
      data-testid="map-canvas"
      key={is3D ? "orbit" : "ortho"}
      views={is3D ? ORBIT : OVIEW}
      initialViewState={initialViewState}
      controller={
        is3D
          ? { dragRotate: true, minZoom: 3, maxZoom: 12 }
          : { dragRotate: false, minZoom: 3, maxZoom: 12 }
      }
      layers={layers}
      style={{ position: "absolute", inset: 0, background: "#0a0d13" }}
      getCursor={({ isDragging }) => (isDragging ? "grabbing" : is3D ? "grab" : "crosshair")}
      onAfterRender={reportBounds}
      onClick={onCanvasClick}
    />
  );
}
