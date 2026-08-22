import React from "react";
import { AlertTriangle } from "lucide-react";
import { LockedFeature } from "./LockedFeature";

/**
 * ErrorState — renders API errors as first-class UI. 402 branches to
 * LockedFeature (an intentional UX state, not an error). 401 tells the
 * builder the key is missing/invalid.
 */
export function ErrorState({ error, title, className = "" }) {
  if (!error) return null;
  if (error.code === 402) {
    return <LockedFeature feature={error.feature} className={className} />;
  }
  const detail =
    error.code === 401
      ? "The API key is missing or invalid. Set REACT_APP_PULSE_KEY_FREE (and _PRO) in the frontend .env, then restart the frontend."
      : error.code === 429
      ? "Rate limited (60/min per key). The UI will resume when the window resets."
      : error.code === 503
      ? "The backend is degraded or has insufficient data for this request."
      : error.message || "Unexpected error";

  return (
    <div
      data-testid="error-state"
      className={`rounded-sm border hairline bg-destructive/10 p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
        <div>
          <div className="text-sm font-medium text-neutral-100">
            {title || `Request failed${error.code ? ` (${error.code})` : ""}`}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title = "No data", note, className = "" }) {
  return (
    <div
      data-testid="empty-state"
      className={`rounded-sm border hairline bg-secondary/30 p-6 text-center ${className}`}
    >
      <div className="text-sm text-neutral-200">{title}</div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}
