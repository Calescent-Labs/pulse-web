import { heatColor } from "./heat";

/**
 * Build a triangle-mesh heightfield from grid-aggregated map cells.
 *
 * The API's `/v1/map?aggregated=grid` returns cells (centres) with `count`
 * and `mean_velocity`. We build a regular vertex lattice covering the whole
 * `bounds` rectangle at `resolution+1` × `resolution+1` vertices — cells the
 * API didn't return fill in as zero-height flatlands.
 *
 * `mode` controls which metric drives elevation and which drives colour:
 *   - "count-heat" (default): elevation = content count, colour = velocity.
 *     Reads as "the ground rises where people are talking; the colour glows
 *     where the story is accelerating".
 *   - "heat-count": elevation = velocity, colour = count. Reads as "the
 *     ground rises where things are heating up; the colour glows where the
 *     audience is dense".
 *
 * Both metrics run through `log1p` compression so single-cell outliers
 * don't crush the rest, then through a wide multi-pass box blur so the
 * terrain reads as smooth ridges and mesas rather than a spike lattice.
 *
 * Returns null when there's nothing to render.
 *
 * @param {{cells: Array, bounds: {minX,maxX,minY,maxY}, mode?: "count-heat"|"heat-count", resolution?: number, elevationScale?: number, blurPasses?: number}} opts
 */
export function buildTerrainMesh({
  cells,
  bounds,
  mode = "count-heat",
  resolution = 64,
  elevationScale = 3.8,
  blurPasses = 4,
}) {
  if (!cells || !cells.length || !bounds) return null;
  const nx = resolution;
  const ny = resolution;
  const cellW = (bounds.maxX - bounds.minX) / nx;
  const cellH = (bounds.maxY - bounds.minY) / ny;
  if (!(cellW > 0) || !(cellH > 0)) return null;

  // Sparse grid keyed by (y, x). Each entry stores raw log-compressed
  // count and velocity. We keep both metrics so a mode-swap doesn't have
  // to refetch.
  const H = new Array(ny + 1);
  for (let y = 0; y <= ny; y++) {
    H[y] = new Array(nx + 1);
    for (let x = 0; x <= nx; x++) H[y][x] = { count: 0, velocity: 0 };
  }

  // Bilinear splat — each cell centre distributes its value onto the four
  // surrounding vertices weighted by proximity. This alone widens the
  // signal footprint and eliminates the "cells snap to a vertex" jaggies
  // that pure nearest-neighbour introduces at high mesh resolutions.
  for (const c of cells) {
    const gx = (c.x - bounds.minX) / cellW;
    const gy = (c.y - bounds.minY) / cellH;
    if (gx < 0 || gx > nx || gy < 0 || gy > ny) continue;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(nx, x0 + 1);
    const y1 = Math.min(ny, y0 + 1);
    const fx = gx - x0;
    const fy = gy - y0;
    const cnt = Math.log1p(c.count || 0);
    const vel = c.mean_velocity || 0;
    const put = (xx, yy, w) => {
      if (xx < 0 || xx > nx || yy < 0 || yy > ny) return;
      H[yy][xx].count += cnt * w;
      H[yy][xx].velocity += vel * w;
    };
    put(x0, y0, (1 - fx) * (1 - fy));
    put(x1, y0, fx * (1 - fy));
    put(x0, y1, (1 - fx) * fy);
    put(x1, y1, fx * fy);
  }

  // 3×3 box blur — multiple passes ≈ larger effective kernel and read
  // as gaussian. 4 passes on a 65-wide grid spreads a peak's influence
  // by ~9 cells in every direction, which visually reads as gentle,
  // widespread ridges instead of jagged spikes.
  const smooth = (grid) => {
    const out = new Array(ny + 1);
    for (let y = 0; y <= ny; y++) {
      out[y] = new Array(nx + 1);
      for (let x = 0; x <= nx; x++) {
        let s = 0, sv = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx;
            if (yy >= 0 && yy <= ny && xx >= 0 && xx <= nx) {
              s += grid[yy][xx].count;
              sv += grid[yy][xx].velocity;
              n++;
            }
          }
        }
        out[y][x] = { count: s / n, velocity: sv / n };
      }
    }
    return out;
  };
  let smoothed = H;
  for (let i = 0; i < blurPasses; i++) smoothed = smooth(smoothed);

  // Which metric drives elevation vs colour.
  const elevKey = mode === "heat-count" ? "velocity" : "count";
  const colorKey = mode === "heat-count" ? "count" : "velocity";

  // Compute normalisers after smoothing so we ramp against what actually paints.
  let maxElev = 0, maxColor = 0;
  for (let y = 0; y <= ny; y++) {
    for (let x = 0; x <= nx; x++) {
      if (smoothed[y][x][elevKey] > maxElev) maxElev = smoothed[y][x][elevKey];
      if (smoothed[y][x][colorKey] > maxColor) maxColor = smoothed[y][x][colorKey];
    }
  }

  const vertexCount = (nx + 1) * (ny + 1);
  const positions = new Float32Array(vertexCount * 3);
  // deck.gl 9.x's SimpleMeshLayer shader consumes `colors` as vec3 with
  // normalised 0..1 floats. Alpha is not supported per-vertex — we fade
  // low-density vertices toward the background colour instead.
  const colors = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);

  // Background colour of the map canvas — low-signal vertices lerp toward
  // this so flatlands disappear against the void rather than showing as
  // muddy dark violet.
  const bgR = 10 / 255, bgG = 13 / 255, bgB = 19 / 255;

  for (let y = 0; y <= ny; y++) {
    for (let x = 0; x <= nx; x++) {
      const idx = y * (nx + 1) + x;
      const wx = bounds.minX + x * cellW;
      const wy = bounds.minY + y * cellH;
      const normElev = maxElev > 0 ? smoothed[y][x][elevKey] / maxElev : 0;
      const wz = normElev * elevationScale;
      positions[idx * 3] = wx;
      positions[idx * 3 + 1] = wy;
      positions[idx * 3 + 2] = wz;

      const normCol = maxColor > 0 ? Math.max(0, Math.min(1, smoothed[y][x][colorKey] / maxColor)) : 0;
      const [r, g, b] = heatColor(normCol);
      // Fade against elevation — flatlands go to background, ridges glow.
      // Softer curve (0.5) than before so mid-elevation regions read.
      const fade = Math.pow(normElev, 0.5);
      const cr = (r / 255) * fade + bgR * (1 - fade);
      const cg = (g / 255) * fade + bgG * (1 - fade);
      const cb = (b / 255) * fade + bgB * (1 - fade);
      colors[idx * 3] = cr;
      colors[idx * 3 + 1] = cg;
      colors[idx * 3 + 2] = cb;
    }
  }

  // Triangle indices — 2 triangles per grid quad.
  const indices = new Uint32Array(nx * ny * 6);
  let ii = 0;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const tl = y * (nx + 1) + x;
      const tr = tl + 1;
      const bl = (y + 1) * (nx + 1) + x;
      const br = bl + 1;
      indices[ii++] = tl;
      indices[ii++] = bl;
      indices[ii++] = tr;
      indices[ii++] = tr;
      indices[ii++] = bl;
      indices[ii++] = br;
    }
  }

  // Per-vertex normals via central-difference of neighbouring heights.
  // Cheaper than face-normal averaging and looks equivalent for smooth terrain.
  for (let y = 0; y <= ny; y++) {
    for (let x = 0; x <= nx; x++) {
      const idx = y * (nx + 1) + x;
      const at = (yy, xx) => positions[(yy * (nx + 1) + xx) * 3 + 2];
      const hL = x > 0 ? at(y, x - 1) : positions[idx * 3 + 2];
      const hR = x < nx ? at(y, x + 1) : positions[idx * 3 + 2];
      const hD = y > 0 ? at(y - 1, x) : positions[idx * 3 + 2];
      const hU = y < ny ? at(y + 1, x) : positions[idx * 3 + 2];
      const dhx = (hR - hL) / (2 * cellW);
      const dhy = (hU - hD) / (2 * cellH);
      const nlen = Math.sqrt(dhx * dhx + dhy * dhy + 1);
      normals[idx * 3] = -dhx / nlen;
      normals[idx * 3 + 1] = -dhy / nlen;
      normals[idx * 3 + 2] = 1 / nlen;
    }
  }

  return {
    positions,
    colors,
    indices,
    normals,
    vertexCount,
    stats: { maxElev, maxColor, nx, ny, mode },
  };
}
