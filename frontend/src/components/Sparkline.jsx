import React, { useMemo } from "react";

/**
 * Sparkline — recent-heat mini chart. Draws gaps for null values rather than
 * interpolating (per data contract). Field defaults to `heat_percentile`, but
 * `velocity` is the honest shape of the arc.
 *
 * Props: { data: {bucket_ts, ...}[], field?: string, width?, height?, stroke?, showZero? }
 */
export function Sparkline({
  data,
  field = "heat_percentile",
  width = 88,
  height = 22,
  stroke = "currentColor",
  showZero = false,
}) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return { d: "", ymin: 0, ymax: 1 };
    const vals = data.map((d) => (d[field] == null ? null : d[field]));
    const nums = vals.filter((v) => v != null);
    if (nums.length < 2) return { d: "", ymin: 0, ymax: 1 };
    const ymin = Math.min(...nums);
    const ymax = Math.max(...nums);
    const range = ymax - ymin || 1;
    const step = width / (vals.length - 1);

    let d = "";
    let penDown = false;
    vals.forEach((v, i) => {
      if (v == null) {
        penDown = false;
        return;
      }
      const x = i * step;
      const y = height - ((v - ymin) / range) * height;
      d += (penDown ? " L" : "M") + `${x.toFixed(1)},${y.toFixed(1)}`;
      penDown = true;
    });
    return { d, ymin, ymax, zeroY: showZero ? height - ((0 - ymin) / range) * height : null };
  }, [data, field, width, height, showZero]);

  return (
    <svg
      data-testid="sparkline"
      width={width}
      height={height}
      className="overflow-visible"
      aria-hidden="true"
    >
      {path.zeroY != null && (
        <line x1={0} x2={width} y1={path.zeroY} y2={path.zeroY} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 2" />
      )}
      <path d={path.d} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
