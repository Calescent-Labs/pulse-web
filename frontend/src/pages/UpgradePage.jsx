import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useClerkAvailability } from "../lib/useClerkAvailability";
import { useSignUpModal } from "../components/SignUpModal";

/**
 * UpgradePage — the "Pro is coming soon" destination.
 *
 * Signed-in users see the coming-soon pane (payments not wired yet, so
 * every account resolves to free tier). Signed-out users see a prompt
 * to sign in first — clicking it opens the Clerk modal. If Clerk isn't
 * configured (no publishable key), the whole page still renders as
 * coming-soon so the URL is never dead.
 */
export default function UpgradePage() {
  const navigate = useNavigate();
  const { clerkEnabled, isSignedIn, openSignIn } = useClerkAvailability();
  const { open: openPlaceholderModal } = useSignUpModal();

  const showSignedInPane = clerkEnabled ? isSignedIn : false;

  const perks = [
    "Time travel — scrub the map back 30 days.",
    "Full trending feed with sector, status, and sentiment filters.",
    "Historical depth per topic — heat, sentiment, members, related.",
    "Cluster investigation and shared research surfaces.",
  ];

  return (
    <AppShell>
      <div data-testid="upgrade-page" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-8 inline-flex items-center gap-1.5 mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-neutral-200"
        >
          <ArrowLeft className="h-3 w-3" />
          back
        </button>

        <div className="mono text-[10px] uppercase tracking-[0.22em] text-[hsl(25,95%,60%)]">
          Pulse Pro
        </div>
        <h1
          className="mt-1 text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-50"
          style={{ letterSpacing: "-0.02em", lineHeight: 1.05 }}
        >
          {showSignedInPane ? (
            <>
              Pro is <span className="heat-3">coming soon.</span>
            </>
          ) : (
            <>
              Unlock <span className="heat-3">Pulse Pro.</span>
            </>
          )}
        </h1>

        {showSignedInPane ? (
          <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-300">
            You&apos;re signed in — your account is set. Payments and Pro
            entitlements aren&apos;t wired yet, so every account is on the free
            tier for now. The moment Pro opens, this page becomes your
            upgrade button.
          </p>
        ) : (
          <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-300">
            Sign in to reserve your account. Payments aren&apos;t open yet;
            every account starts on the free tier, and you&apos;ll be
            first-in-line when Pro launches.
          </p>
        )}

        <ul className="mt-8 space-y-2.5">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm text-neutral-200">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[hsl(25,95%,60%)]" />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-sm border hairline bg-background/40 p-4">
          {showSignedInPane ? (
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-[hsl(25,95%,60%)]" />
              <div>
                <div className="mono text-[10px] uppercase tracking-[0.22em] text-[hsl(25,95%,60%)]">
                  status
                </div>
                <div className="mt-0.5 text-sm text-neutral-100">
                  Waitlist secured. We&apos;ll email you the moment Pro opens.
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-neutral-300">
                Ready to reserve your spot?
              </div>
              <button
                data-testid="upgrade-sign-in"
                onClick={() => {
                  if (clerkEnabled) openSignIn();
                  else openPlaceholderModal("sign in");
                }}
                className="inline-flex items-center gap-2 rounded-sm bg-[hsl(25,95%,60%)] px-4 py-2 mono text-[11px] uppercase tracking-widest text-[hsl(220,15%,7%)] hover:translate-y-[-1px] transition-transform"
              >
                <Sparkles className="h-3 w-3" />
                sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
