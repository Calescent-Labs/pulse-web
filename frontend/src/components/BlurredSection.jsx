import React from "react";
import { Lock, Sparkles } from "lucide-react";

/**
 * BlurredSection — Free-tier gating wrapper.
 *
 * Blurs its children and overlays a subtle "coming with Pro" label so users
 * see the shape of what's being withheld without reading the actual values.
 *
 * Props:
 *   active: boolean            — when true, applies the blur & overlay
 *   label?: string             — small overlay caption (defaults to "Pro")
 *   sticky?: boolean           — when true, label sticks at top-24 as user
 *                                scrolls through a tall blurred region
 *   className?: string
 */
export function BlurredSection({ active = true, label, sticky = false, className = "", children }) {
  if (!active) return <>{children}</>;
  return (
    <div
      data-testid="blurred-section"
      className={`relative overflow-hidden rounded-sm ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none select-none"
        style={{
          filter: "blur(6px) grayscale(0.35)",
          opacity: 0.7,
        }}
      >
        {children}
      </div>
      <div
        className={`pointer-events-none absolute inset-0 flex ${
          sticky ? "items-start pt-6" : "items-center"
        } justify-center`}
      >
        <div
          className={`inline-flex items-center gap-1.5 rounded-sm border hairline bg-background/85 px-2.5 py-1 mono text-[10px] uppercase tracking-[0.18em] text-[hsl(25,95%,60%)] backdrop-blur ${
            sticky ? "sticky top-24" : ""
          }`}
        >
          <Sparkles className="h-3 w-3" />
          <Lock className="h-3 w-3 text-neutral-400" />
          <span>{label || "Coming with Pro"}</span>
        </div>
      </div>
    </div>
  );
}
