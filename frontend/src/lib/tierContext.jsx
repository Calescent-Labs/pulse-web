import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

/**
 * Tier context. Holds the active tier ('free' | 'pro') and exposes the
 * X-API-Key that should accompany requests. The dev toggle is only shown
 * when REACT_APP_DEV_TIER_TOGGLE === 'true' — never in production builds.
 *
 * Gating is enforced server-side. The client only reacts to 402 responses.
 */
const TierContext = createContext(null);

const FREE_KEY = process.env.REACT_APP_PULSE_KEY_FREE || "";
const PRO_KEY = process.env.REACT_APP_PULSE_KEY_PRO || "";
const DEV_TOGGLE_ENABLED = process.env.REACT_APP_DEV_TIER_TOGGLE === "true";

export function TierProvider({ children }) {
  // Promo unlock — Pro features are free for a limited time. As long as a
  // Pro API key is configured we default every visitor to the Pro tier,
  // which unlocks every gated component through the existing useTier()
  // consumers (SignalsPanel, TrendingPage, TopicDetailPage, queries.js).
  // Falls back to Free automatically if no Pro key is configured.
  const [tier, setTier] = useState(/** @type {'free'|'pro'} */ (
    PRO_KEY ? "pro" : "free"
  ));

  const apiKey = tier === "pro" ? PRO_KEY : FREE_KEY;

  const setTierSafe = useCallback(
    (t) => {
      if (t !== "pro" && t !== "free") return;
      if (t === "pro" && !PRO_KEY) return; // no pro key configured — no-op
      setTier(t);
    },
    [],
  );

  const value = useMemo(
    () => ({
      tier,
      apiKey,
      setTier: setTierSafe,
      devToggleEnabled: DEV_TOGGLE_ENABLED,
      hasFreeKey: Boolean(FREE_KEY),
      hasProKey: Boolean(PRO_KEY),
      // True while the "Pro free for a limited time" promo is active. Real
      // paid Pro accounts will not set this — the banner disappears once
      // the promo ends and gating (or real subscriptions) come back.
      promoUnlock: Boolean(PRO_KEY) && tier === "pro",
    }),
    [tier, apiKey, setTierSafe],
  );

  return <TierContext.Provider value={value}>{children}</TierContext.Provider>;
}

export function useTier() {
  const ctx = useContext(TierContext);
  if (!ctx) throw new Error("useTier must be used inside <TierProvider>");
  return ctx;
}
