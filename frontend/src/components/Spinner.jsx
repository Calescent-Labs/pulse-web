import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Spinner — small animated indicator for any "we're fetching, hang on"
 * state. Uses lucide's Loader2 + Tailwind's animate-spin so it inherits
 * currentColor from its parent (works on light & dark surfaces without
 * a separate variant).
 *
 * Sizes are kept coarse on purpose (xs/sm/md) so the map surface reads
 * consistently — no arbitrary pixel sizes scattered through pages.
 */
const SIZE_CLASS = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
};

export function Spinner({ size = "sm", className = "", label }) {
  const cls = SIZE_CLASS[size] || SIZE_CLASS.sm;
  return (
    <span
      data-testid="spinner"
      role="status"
      aria-label={label || "Loading"}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <Loader2 className={`${cls} animate-spin`} aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}
