import React from "react";
import { Lock, Zap } from "lucide-react";

/**
 * LockedFeature — a first-class UI state triggered by the API's 402 responses.
 * The `feature` prop comes from the API's `detail.feature` string; we render
 * the description of what it *does*, not just that it's locked.
 *
 * Copy per feature is descriptive, not sales-y — matches the "instrument, not
 * marketing" tone.
 */
const FEATURE_COPY = {
  "time travel":
    "See what the map looked like at any hour in the last 30 days. Watch a story ignite in one region and spread — same geography, different weather.",
  "sector filter":
    "Narrow the ranked feed to a single sector. Answer 'what's rising in gaming right now' without scanning the whole feed.",
  "extended history":
    "Follow a topic's arc for up to 30 days instead of 24 hours. See where it came from, not just where it is.",
  "extended window":
    "Widen the map beyond 24 hours — up to 30 days. Longer windows reveal slower-building stories the daily view misses.",
};

function copyFor(feature) {
  if (!feature) return "This capability is available on Pro.";
  const key = feature.toLowerCase();
  return FEATURE_COPY[key] || `Available on Pro: ${feature}.`;
}

export function LockedFeature({ feature, compact = false, className = "" }) {
  const desc = copyFor(feature);

  if (compact) {
    return (
      <div
        data-testid="locked-feature-compact"
        className={`inline-flex items-center gap-2 rounded-sm border hairline bg-secondary/60 px-2 py-1 text-[11px] text-muted-foreground ${className}`}
      >
        <Lock className="h-3 w-3" />
        <span className="uppercase tracking-widest text-[10px]">Pro</span>
        <span className="text-neutral-300">·</span>
        <span className="text-neutral-200">{feature || "Locked"}</span>
      </div>
    );
  }

  return (
    <div
      data-testid="locked-feature"
      className={`rounded-sm border hairline bg-secondary/40 p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-sm border hairline bg-background/60 p-1.5">
          <Lock className="h-3.5 w-3.5 text-neutral-300" />
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">Pro</span>
            <span className="text-neutral-500">·</span>
            <span className="text-sm font-medium text-neutral-100">
              {feature ? feature.replace(/(^\w|\s\w)/g, (m) => m.toUpperCase()) : "Locked capability"}
            </span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">{desc}</p>
        </div>
        <button
          data-testid="upgrade-cta"
          className="inline-flex items-center gap-1.5 rounded-sm border hairline bg-background px-3 py-1.5 text-xs text-neutral-100 transition-colors hover:bg-secondary"
          onClick={() => {
            /* No payment integration yet — CTA is intentionally inert per brief. */
          }}
        >
          <Zap className="h-3 w-3" />
          Upgrade
        </button>
      </div>
    </div>
  );
}
