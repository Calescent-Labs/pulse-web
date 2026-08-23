import React, { createContext, useCallback, useContext, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";

/**
 * SignUpModal — placeholder Pro sign-up affordance.
 *
 * Wired to every "Coming with Pro" pill across the app. Today it's a
 * notify-me/coming-soon state; the moment auth + billing land, this component
 * swaps to a real form without changing any of the pills that trigger it.
 */
const SignUpContext = createContext(null);

export function SignUpProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [triggerFeature, setTriggerFeature] = useState(null);

  const openModal = useCallback((feature) => {
    setTriggerFeature(feature || null);
    setOpen(true);
  }, []);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <SignUpContext.Provider value={{ open: openModal, close: closeModal }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-testid="signup-modal"
          className="max-w-md border hairline bg-background text-neutral-100"
        >
          <DialogHeader>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {triggerFeature ? `Pro · ${triggerFeature}` : "Pulse Pro"}
            </div>
            <DialogTitle
              className="mt-1 text-2xl font-semibold tracking-tight text-neutral-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              Sign-up is on the way.
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-neutral-400">
              Pulse Pro isn&apos;t open yet — we&apos;re building the account
              system alongside the next milestone. Drop your email and we&apos;ll
              send you exactly one message the moment it opens.
            </DialogDescription>
          </DialogHeader>

          <ul className="my-2 space-y-1.5 border-l border-l-[hsl(25,95%,60%)]/40 pl-3 text-xs text-neutral-300">
            <li>Time travel — scrub the map back 30 days.</li>
            <li>Full trending feed with sector, status, sentiment filters.</li>
            <li>Historical depth per topic — heat, sentiment, members, related.</li>
            <li>Cluster investigation and shared research surfaces.</li>
          </ul>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              // Placeholder — no backend to POST to. When auth lands, wire here.
              closeModal();
            }}
            className="mt-2 flex flex-col gap-2"
          >
            <label className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Email
            </label>
            <input
              data-testid="signup-email"
              type="email"
              placeholder="you@domain.com"
              className="w-full rounded-sm border hairline bg-secondary/40 px-3 py-2 text-sm text-neutral-100 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(25,95%,60%)]"
              autoComplete="email"
            />
            <p className="mono text-[10px] normal-case tracking-normal text-neutral-500">
              We&apos;ll only use this to send the launch note. No newsletters.
            </p>
            <DialogFooter className="mt-2 flex-row justify-end gap-2 sm:justify-end">
              <button
                type="button"
                data-testid="signup-close"
                onClick={closeModal}
                className="rounded-sm border hairline bg-background/60 px-3 py-2 mono text-[11px] uppercase tracking-widest text-neutral-200 hover:bg-secondary"
              >
                not now
              </button>
              <button
                type="submit"
                data-testid="signup-submit"
                className="inline-flex items-center gap-1.5 rounded-sm bg-[hsl(25,95%,60%)] px-3 py-2 mono text-[11px] uppercase tracking-widest text-[hsl(220,15%,7%)] transition-transform hover:translate-y-[-1px]"
              >
                <Sparkles className="h-3 w-3" />
                notify me
                <ArrowRight className="h-3 w-3" />
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SignUpContext.Provider>
  );
}

export function useSignUpModal() {
  const ctx = useContext(SignUpContext);
  if (!ctx) {
    // Fail-soft — components can still render if provider is missing.
    return { open: () => {}, close: () => {} };
  }
  return ctx;
}
