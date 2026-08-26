import { useAuth, useClerk } from "@clerk/clerk-react";

const CLERK_ENABLED = Boolean(process.env.REACT_APP_CLERK_PUBLISHABLE_KEY);

/**
 * useClerkAvailability — a single hook that answers "can we do auth
 * right now?" and returns safe callables regardless.
 *
 * `CLERK_ENABLED` is a compile-time constant (env var), so the hook
 * call pattern is stable across the whole session — React's rules-of-
 * hooks are satisfied even though the calls sit under a runtime guard.
 * When Clerk isn't wired, callers get a fully no-op interface and
 * every component keeps rendering.
 */
export function useClerkAvailability() {
  let auth = null;
  let clerk = null;
  if (CLERK_ENABLED) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    auth = useAuth();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    clerk = useClerk();
  }

  const clerkEnabled = CLERK_ENABLED;
  const isLoaded = clerkEnabled ? Boolean(auth?.isLoaded) : true;
  const isSignedIn = clerkEnabled ? Boolean(auth?.isSignedIn) : false;

  const openSignIn = (redirectUrlAfter = typeof window !== "undefined" ? window.location.pathname : "/") => {
    if (!clerkEnabled || !clerk) return false;
    try {
      clerk.openSignIn({
        withSignUp: true,
        redirectUrl: redirectUrlAfter,
        afterSignInUrl: redirectUrlAfter,
        afterSignUpUrl: redirectUrlAfter,
      });
      return true;
    } catch {
      return false;
    }
  };

  const signOut = () => {
    if (!clerkEnabled || !clerk) return;
    try {
      clerk.signOut();
    } catch {
      /* no-op */
    }
  };

  return { clerkEnabled, isLoaded, isSignedIn, openSignIn, signOut };
}
