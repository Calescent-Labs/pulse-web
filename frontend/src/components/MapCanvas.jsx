import React, { useCallback, useMemo, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { OrthographicView, OrbitView, LightingEffect, AmbientLight, DirectionalLight } from "@deck.gl/core";
import { HEATMAP_COLOR_RANGE, heatColor } from "../lib/heat";
import { buildTerrainMesh } from "../lib/terrainMesh";

/**
 * MapCanvas — deck.gl-backed semantic map.
 *
 * 2D mode (default): heat regions only, no per-signal dots, plus a
 * per-topic outline layer that lights up on signals-panel hover so
 * a topic's geography is legible without leaking channel or platform
 * names. Clicking anywhere fires `onRegionClick({ x, y })` which the
 * parent uses to open the region investigation panel.
 *
 * 3D mode: a continuous topographic terrain. The API returns grid-
 * aggregated cells via `/v1/map?aggregated=grid&points=false`. We build
 * a triangle-mesh heightfield where elevation encodes content count and
 * per-vertex colour encodes velocity (heat ramp). A directional light
 * gives the surface its ridges and valleys. Clicking anywhere on the
 * terrain fires `onRegionClick({ x, y })` from `info.coordinate`.
 */
const OVIEW = new OrthographicView({ id: "ortho", controller: true });
const ORBIT = new OrbitView({ id: "orbit", controller: true, orbitAxis: "Z", fov: 50 });

// Lighting rig for the 3D terrain. Ambient keeps shadow sides readable;
// directional carves ridges. Reused across renders — safe to define once.
const TERRAIN_LIGHTING = new LightingEffect({
  ambient: new AmbientLight({ color: [255, 255, 255], intensity: 1.35 }),
  key: new DirectionalLight({
    color: [255, 240, 220],
    intensity: 2.2,
    direction: [-1, -2, -1.4],
    _shadow: false,
  }),
  fill: new DirectionalLight({
    color: [180, 190, 255],
    intensity: 0.6,
    direction: [1, 1.5, -0.6],
  }),
});

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
      ? { target: [cx, cy, 0], rotationX: 50, rotationOrbit: 25, zoom: 5.2 }
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

  // Terrain mesh — built once per (cells, bounds) update.
  const terrain = useMemo(() => {
    if (!is3D) return null;
    return buildTerrainMesh({ cells, bounds, resolution: 50, elevationScale: 3.5 });
  }, [is3D, cells, bounds]);

  const layers = useMemo(() => {
    const out = [];

    if (is3D) {
      if (terrain) {
        // Continuous heightfield terrain — one big mesh placed at world
        // origin. Vertex positions already live in world coords, so
        // getPosition is a no-op.
        //
        // deck.gl 9.x's SimpleMeshLayer expects each attribute as
        // { value: TypedArray, size }. `indices` sits alongside
        // `attributes` (not inside it) so the geometry builder can pick
        // it up separately.
        out.push(
          new SimpleMeshLayer({
            id: "terrain-3d",
            data: [{ position: [0, 0, 0] }],
            mesh: {
              attributes: {
                positions: { value: terrain.positions, size: 3 },
                normals: { value: terrain.normals, size: 3 },
                colors: { value: terrain.colors, size: 3 },
              },
              indices: { value: terrain.indices, size: 1 },
            },
            getPosition: (d) => d.position,
            // Vertex colours drive the palette — this multiplier just
            // passes them through.
            getColor: [255, 255, 255, 255],
            pickable: true,
            material: {
              ambient: 0.42,
              diffuse: 0.9,
              shininess: 18,
              specularColor: [40, 30, 60],
            },
            parameters: { depthTest: true },
            _instanced: false,
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
  }, [is3D, heatData, highlightPoints, showHeat, hoveredTopicId, terrain]);

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

  // Click-to-investigate — works in both 2D and 3D. In 2D the OrthographicView
  // ground plane gives us `info.coordinate` for any click; in 3D the terrain
  // mesh's picking supplies the world (x,y) of the surface point under the
  // cursor. Clicks that miss the mesh in 3D return no coordinate, so we
  // simply drop them.
  const onCanvasClick = useCallback(
    (info) => {
      if (!onRegionClick) return;
      if (!info || !info.coordinate) return;
      const [x, y] = info.coordinate;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      onRegionClick({ x, y, radius: 1.0 });
    },
    [onRegionClick],
  );

  const effects = useMemo(() => (is3D ? [TERRAIN_LIGHTING] : []), [is3D]);

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
      effects={effects}
      style={{ position: "absolute", inset: 0, background: "#0a0d13" }}
      getCursor={({ isDragging }) => (isDragging ? "grabbing" : is3D ? "grab" : "crosshair")}
      onAfterRender={reportBounds}
      onClick={onCanvasClick}
    />
  );
}
