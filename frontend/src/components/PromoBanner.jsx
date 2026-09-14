import React, { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useTier } from "../lib/tierContext";

/**
 * PromoBanner — a slim strip under the app header announcing that Pro
 * features are free for a limited time.
 *
 * Only renders when the tier context reports `promoUnlock` (i.e. a Pro
 * API key is configured and the visitor is currently in Pro mode). Once
 * the promo ends and gating comes back — or a real subscription tier
 * lands — the banner disappears automatically.
 *
 * Dismissal is remembered in localStorage so returning visitors are not
 * nagged. New visitors on a fresh browser still see it once.
 */
const DISMISS_KEY = "pulse:promoBannerDismissed";

export function PromoBanner() {
  const { promoUnlock } = useTier();
  const [dismissed, setDismissed] = useState(() => {
    try {
      if (typeof localStorage === "undefined") return false;
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!dismissed) return;
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* no-op */
    }
  }, [dismissed]);

  if (!promoUnlock || dismissed) return null;

  return (
    <div
      data-testid="promo-banner"
      role="status"
      className="relative flex items-center justify-center gap-3 border-b hairline bg-[hsl(25,95%,12%)]/60 px-4 py-2 mono text-[11px] uppercase tracking-[0.18em] text-[hsl(25,95%,72%)] backdrop-blur"
    >
      <Sparkles className="h-3 w-3" />
      <span className="text-center">
        <span className="text-neutral-50">Pro is unlocked</span>
        <span className="text-neutral-500"> · </span>
        <span>every feature free for a limited time</span>
      </span>
      <button
        type="button"
        data-testid="promo-banner-dismiss"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-neutral-400 transition-colors hover:bg-background/40 hover:text-neutral-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
