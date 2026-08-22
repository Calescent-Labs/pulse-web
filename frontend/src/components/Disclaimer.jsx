import React from "react";
import { Info } from "lucide-react";

/**
 * Persistent disclaimer footer. The API's `meta.disclaimer` appears on every
 * response containing scores. We honour that contract at the surface level.
 */
export function Disclaimer({ text, className = "" }) {
  return (
    <div
      data-testid="disclaimer"
      className={`flex items-start gap-2 border-t hairline bg-background/80 px-4 py-2 text-[11px] text-muted-foreground ${className}`}
    >
      <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
      <span className="leading-relaxed">
        {text || "Heat is a relative attention signal, not a verified fact. Every score ships with its confidence."}
      </span>
    </div>
  );
}
