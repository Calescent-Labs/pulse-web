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
  // Default to free tier — Pro is opt-in via the dev toggle only.
  const [tier, setTier] = useState(/** @type {'free'|'pro'} */ ("free"));

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
