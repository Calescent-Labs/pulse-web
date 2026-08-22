// Heat ramp shared between DOM and deck.gl. Ramp goes:
// transparent → deep violet → red → orange → pale yellow.

const STOPS = [
  { t: 0.0, rgba: [30, 34, 45, 0] }, // transparent
  { t: 0.35, rgba: [90, 40, 180, 180] }, // deep violet
  { t: 0.6, rgba: [220, 40, 90, 220] }, // red
  { t: 0.82, rgba: [255, 130, 30, 235] }, // orange
  { t: 1.0, rgba: [255, 235, 140, 245] }, // pale yellow
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** @param {number} v 0..1 @returns {[number,number,number,number]} */
export function heatColor(v) {
  const x = Math.max(0, Math.min(1, v || 0));
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i].t) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const k = (x - a.t) / (b.t - a.t);
      return [
        Math.round(lerp(a.rgba[0], b.rgba[0], k)),
        Math.round(lerp(a.rgba[1], b.rgba[1], k)),
        Math.round(lerp(a.rgba[2], b.rgba[2], k)),
        Math.round(lerp(a.rgba[3], b.rgba[3], k)),
      ];
    }
  }
  return STOPS[STOPS.length - 1].rgba;
}

export function heatColorCss(v) {
  const [r, g, b, a] = heatColor(v);
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`;
}

/** For deck.gl HeatmapLayer's colorRange (no alpha). */
export const HEATMAP_COLOR_RANGE = [
  [50, 30, 90],
  [90, 40, 180],
  [180, 40, 130],
  [220, 40, 90],
  [255, 130, 30],
  [255, 235, 140],
];

/** Age (hours) → cool blue-ish colour. Younger = brighter cyan. */
export function ageColor(ageHours) {
  const h = Math.max(0, Math.min(72, ageHours || 0));
  const t = 1 - h / 72;
  return [
    Math.round(lerp(90, 90, t)),
    Math.round(lerp(140, 210, t)),
    Math.round(lerp(180, 245, t)),
    220,
  ];
}

/** Velocity → the heat ramp, but clamped: velocity magnitudes ~0..0.2 in practice. */
export function velocityColor(velocity) {
  const norm = Math.max(0, Math.min(1, (velocity || 0) / 0.15));
  return heatColor(norm);
}
