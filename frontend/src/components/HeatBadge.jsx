import React from "react";
import { formatConfidence, formatPercentile } from "../lib/format";

/**
 * HeatBadge — always shows heat percentile paired with its confidence.
 * The percentile's visual weight scales with confidence: a low-confidence
 * 0.99 renders as *provisional*, not authoritative.
 *
 * Props: { percentile: number, confidence: number, size?: 'sm'|'md'|'lg', className?: string }
 */
export function HeatBadge({ percentile, confidence, size = "md", className = "" }) {
  const c = confidence == null ? 0 : Math.max(0, Math.min(0.95, confidence));
  // Opacity scales 0.42..1.0 based on confidence.
  const opacity = 0.42 + (c / 0.95) * 0.58;
  const heatTier =
    percentile == null ? 0 : percentile >= 0.99 ? 4 : percentile >= 0.9 ? 3 : percentile >= 0.75 ? 2 : percentile >= 0.5 ? 1 : 0;

  const sizeCls =
    size === "sm"
      ? "text-xs"
      : size === "lg"
      ? "text-lg sm:text-xl"
      : "text-sm sm:text-base";

  return (
    <div
      data-testid="heat-badge"
      className={`inline-flex items-baseline gap-2 tabular ${className}`}
      title={`Heat percentile ${formatPercentile(percentile)} — confidence ${formatConfidence(confidence)}`}
    >
      <span
        className={`heat-${heatTier} ${sizeCls} font-semibold provisional`}
        style={{ opacity }}
      >
        {formatPercentile(percentile)}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        ± <span className="mono text-neutral-300">{formatConfidence(confidence)}</span>
      </span>
    </div>
  );
}
