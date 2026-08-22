import React from "react";
import { statusLabel } from "../lib/format";

const STATUS_STYLE = {
  emerging: { dot: "hsl(48, 95%, 66%)", label: "Emerging" },
  accelerating: { dot: "hsl(25, 95%, 60%)", label: "Accelerating" },
  peaking: { dot: "hsl(0, 78%, 62%)", label: "Peaking" },
  declining: { dot: "hsl(220, 8%, 62%)", label: "Declining" },
  resurfaced: { dot: "hsl(268, 65%, 65%)", label: "Resurfaced" },
  dormant: { dot: "hsl(220, 8%, 40%)", label: "Dormant" },
};

export function StatusChip({ status, className = "" }) {
  const meta = STATUS_STYLE[status] || null;
  return (
    <span
      data-testid="status-chip"
      className={`inline-flex items-center gap-1.5 rounded-sm border hairline px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-neutral-300 ${className}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: meta ? meta.dot : "hsl(220, 8%, 40%)" }}
      />
      {meta ? meta.label : statusLabel(status)}
    </span>
  );
}
