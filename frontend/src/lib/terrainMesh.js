import { heatColor } from "./heat";

/**
 * Build a triangle-mesh heightfield from grid-aggregated map cells.
 *
 * The API's `/v1/map?aggregated=grid` returns cells (centres) with `count`
 * and `mean_velocity`. We build a regular vertex lattice covering the whole
 * `bounds` rectangle at `resolution+1` × `resolution+1` vertices — cells the
 * API didn't return fill in as zero-height flatlands.
 *
 * Elevation encodes **content count** (via log1p so highly-populated cells
 * don't crush the rest). Colour encodes **velocity** through the shared
 * heat ramp, so a tall, cool ridge means "big audience, cold" and a tall,
 * yellow ridge means "big audience, actively heating up". A 3×3 box blur
 * smooths the surface into readable ridges rather than isolated spikes.
 *
 * Returns null when there's nothing to render.
 *
 * @param {{cells: Array, bounds: {minX,maxX,minY,maxY}, resolution?: number, elevationScale?: number}} opts
 */
export function buildTerrainMesh({ cells, bounds, resolution = 50, elevationScale = 3.5 }) {
  if (!cells || !cells.length || !bounds) return null;
  const nx = resolution;
  const ny = resolution;
  const cellW = (bounds.maxX - bounds.minX) / nx;
  const cellH = (bounds.maxY - bounds.minY) / ny;
  if (!(cellW > 0) || !(cellH > 0)) return null;

  // Sparse grid keyed by (y, x). Each entry accumulates count + velocity.
  const H = new Array(ny + 1);
  for (let y = 0; y <= ny; y++) {
    H[y] = new Array(nx + 1);
    for (let x = 0; x <= nx; x++) H[y][x] = { count: 0, velocity: 0 };
  }

  for (const c of cells) {
    const xIdx = Math.round((c.x - bounds.minX) / cellW);
    const yIdx = Math.round((c.y - bounds.minY) / cellH);
    if (xIdx < 0 || xIdx > nx || yIdx < 0 || yIdx > ny) continue;
    // log1p compresses runaway single-cell populations; keeps the tallest
    // peaks visible without flattening everything else.
    H[yIdx][xIdx].count = Math.log1p(c.count || 0);
    H[yIdx][xIdx].velocity = c.mean_velocity || 0;
  }

  // 3x3 box blur — twice, so the terrain reads as smooth ridges rather
  // than a pixelated array of spikes. Two passes ≈ larger kernel.
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
  const smoothed = smooth(smooth(H));

  // Compute normalisers after smoothing so we ramp against what actually paints.
  let maxCount = 0, maxV = 0;
  for (let y = 0; y <= ny; y++) {
    for (let x = 0; x <= nx; x++) {
      if (smoothed[y][x].count > maxCount) maxCount = smoothed[y][x].count;
      if (smoothed[y][x].velocity > maxV) maxV = smoothed[y][x].velocity;
    }
  }

  const vertexCount = (nx + 1) * (ny + 1);
  const positions = new Float32Array(vertexCount * 3);
  // deck.gl 9.x's SimpleMeshLayer shader consumes `colors` as vec3 with
  // normalised 0..1 floats. Alpha is not supported per-vertex — we fade
  // low-density vertices toward the background colour instead.
  const colors = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);

  // Background colour of the map canvas — low-density vertices lerp toward
  // this so flatlands disappear against the void rather than showing as
  // muddy dark violet.
  const bgR = 10 / 255, bgG = 13 / 255, bgB = 19 / 255;

  for (let y = 0; y <= ny; y++) {
    for (let x = 0; x <= nx; x++) {
      const idx = y * (nx + 1) + x;
      const wx = bounds.minX + x * cellW;
      const wy = bounds.minY + y * cellH;
      const normCount = maxCount > 0 ? smoothed[y][x].count / maxCount : 0;
      const wz = normCount * elevationScale;
      positions[idx * 3] = wx;
      positions[idx * 3 + 1] = wy;
      positions[idx * 3 + 2] = wz;

      const normV = maxV > 0 ? Math.max(0, Math.min(1, smoothed[y][x].velocity / maxV)) : 0;
      const [r, g, b] = heatColor(normV);
      // Fade factor — 0 at empty ground, 1 at max density. Curve slightly
      // so mid-density regions still glow.
      const fade = Math.pow(normCount, 0.55);
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
    stats: { maxCount, maxV, nx, ny },
  };
}
