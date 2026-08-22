import React from "react";

/**
 * SentimentIndicator — encodes mean, polarisation, and sample size honestly.
 * A divided audience (mean≈0, high polarisation) MUST NOT render identically
 * to an indifferent one (mean≈0, low polarisation).
 *
 * Props: { mean, polarisation, sampleSize, size?: 'sm'|'md' }
 */
export function SentimentIndicator({ mean, polarisation, sampleSize, size = "md" }) {
  if (mean == null) {
    return (
      <span
        data-testid="sentiment-empty"
        className="mono text-xs text-muted-foreground"
        title="No comment data yet"
      >
        no signal
      </span>
    );
  }

  const w = size === "sm" ? 44 : 64;
  const h = size === "sm" ? 8 : 10;
  // Bar centre is 0.5; mean −1..1 maps to 0..1.
  const cx = ((mean + 1) / 2) * w;
  const isDivided = polarisation != null && Math.abs(mean) < 0.15 && polarisation > 0.35;
  const isProvisional = sampleSize != null && sampleSize < 10;

  return (
    <div
      data-testid="sentiment-indicator"
      className={`inline-flex items-center gap-2 ${isProvisional ? "opacity-70" : ""}`}
      title={`mean ${mean.toFixed(2)} · polarisation ${polarisation == null ? "—" : polarisation.toFixed(2)} · n=${sampleSize ?? "—"}`}
    >
      <svg width={w} height={h + 6} className="overflow-visible">
        {/* neutral track */}
        <rect x={0} y={3} width={w} height={h} rx={h / 2} fill="rgba(255,255,255,0.06)" />
        {/* mid tick */}
        <line x1={w / 2} y1={0} x2={w / 2} y2={h + 6} stroke="rgba(255,255,255,0.16)" strokeDasharray="2 2" />
        {/* polarisation spread */}
        {polarisation != null && (
          <rect
            x={Math.max(0, cx - (polarisation * w) / 2)}
            y={4}
            width={Math.min(w, polarisation * w)}
            height={h - 2}
            rx={(h - 2) / 2}
            fill={isDivided ? "rgba(255, 130, 30, 0.35)" : "rgba(120, 140, 180, 0.28)"}
          />
        )}
        {/* mean dot */}
        <circle
          cx={cx}
          cy={h / 2 + 3}
          r={size === "sm" ? 3 : 4}
          fill={
            mean > 0.15
              ? "hsl(140, 55%, 60%)"
              : mean < -0.15
              ? "hsl(0, 70%, 62%)"
              : isDivided
              ? "hsl(25, 95%, 60%)"
              : "hsl(220, 8%, 65%)"
          }
        />
      </svg>
      <span className="mono text-[10px] text-muted-foreground whitespace-nowrap">
        n=<span className="text-neutral-200">{sampleSize ?? "—"}</span>
        {isDivided && <span className="ml-1 heat-3">divided</span>}
      </span>
    </div>
  );
}
