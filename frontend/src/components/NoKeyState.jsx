import React from "react";
import { KeyRound } from "lucide-react";

/**
 * Rendered when REACT_APP_PULSE_KEY_FREE is empty. The API is reachable via
 * the health endpoint (no auth) but authenticated endpoints won't fire.
 */
export function NoKeyState({ className = "" }) {
  return (
    <div
      data-testid="no-key-state"
      className={`rounded-sm border hairline bg-amber-500/5 p-5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-4 w-4 text-amber-300" />
        <div>
          <div className="text-sm font-medium text-neutral-100">API key not configured</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground max-w-xl">
            Set <span className="mono text-neutral-200">REACT_APP_PULSE_KEY_FREE</span>
            {" "}(and{" "}<span className="mono text-neutral-200">REACT_APP_PULSE_KEY_PRO</span>{" "}
            for the tier toggle) in <span className="mono text-neutral-200">/app/frontend/.env</span>,
            then restart the frontend. The health endpoint below confirms the base URL is reachable.
          </p>
        </div>
      </div>
    </div>
  );
}
