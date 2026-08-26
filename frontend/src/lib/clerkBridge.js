import React, { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

/**
 * Clerk token bridge — the single place where a React hook writes the
 * current session's `getToken` function into a module-level ref that the
 * plain-JS `pulseClient` fetch wrapper can await at request time.
 *
 * The playbook warns against a naive module-global token cache (staleness
 * after sign-in/out). We solve that by writing the LIVE `getToken`
 * FUNCTION reference — never a raw token — and clearing it on unmount.
 * `getToken()` itself is stable across the Clerk session lifetime and
 * always resolves to the latest token (or null when signed out).
 */
let _tokenGetter = null;
let _isSignedIn = false;

/** Read the current bearer token, or null if signed out / bridge unmounted. */
export async function getClerkToken() {
  if (!_tokenGetter) return null;
  try {
    return await _tokenGetter();
  } catch {
    return null;
  }
}

/** Sync-read whether a Clerk session is currently active. */
export function isClerkSignedIn() {
  return _isSignedIn;
}

/** Set once at bootstrap when the app is running WITHOUT a ClerkProvider. */
export function markClerkDisabled() {
  _tokenGetter = null;
  _isSignedIn = false;
}

/**
 * Bridge component — must be rendered inside <ClerkProvider>. Publishes
 * the current `getToken` function and signed-in flag into module state
 * for use by `pulseClient.request`.
 */
export function ClerkAuthBridge() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    _tokenGetter = getToken;
    _isSignedIn = Boolean(isSignedIn);
    return () => {
      _tokenGetter = null;
      _isSignedIn = false;
    };
  }, [getToken, isSignedIn, isLoaded]);

  return null;
}
