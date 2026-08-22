import React from "react";

/**
 * ClosenessRadar — 5-segment bar visualising cosine centroid closeness.
 * 100% (d=0) fills all 5 segments in the hot ramp; near 0% dims to muted.
 * Reads at a glance whether a neighbour is a close cousin or a distant relative.
 */
export function ClosenessRadar({ closeness = 0, className = "" }) {
  const segments = 5;
  const filled = Math.max(0, Math.min(segments, Math.round(closeness * segments)));
  // Color intensifies as closeness climbs.
  const colorFor = (i) => {
    if (i >= filled) return "rgba(255,255,255,0.06)";
    // ramp uses violet→red→orange as closeness grows
    if (closeness >= 0.8) return "hsl(25, 95%, 60%)";
    if (closeness >= 0.6) return "hsl(340, 78%, 60%)";
    if (closeness >= 0.4) return "hsl(268, 65%, 62%)";
    return "hsl(220, 8%, 55%)";
  };
  return (
    <div
      data-testid="closeness-radar"
      className={`inline-flex items-center gap-[3px] ${className}`}
      aria-label={`Closeness ${Math.round(closeness * 100)} percent`}
    >
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-[1px] transition-colors"
          style={{ background: colorFor(i) }}
        />
      ))}
    </div>
  );
}
