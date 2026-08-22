// Formatting helpers — presentation-only, no data mutation.

export function formatPercentile(p) {
  if (p == null || Number.isNaN(p)) return "—";
  // Percentile is a rank; present as "P##".
  return `P${Math.round(p * 100)}`;
}

export function formatConfidence(c) {
  if (c == null || Number.isNaN(c)) return "—";
  return `${Math.round(c * 100)}%`;
}

export function formatSigned(n, digits = 3) {
  if (n == null || Number.isNaN(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(digits)}`;
}

export function formatNumber(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatCompact(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatHoursAgo(hours) {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function formatRelativeFromISO(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = (now - t) / 60000;
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${Math.round(diffMin)}m ago`;
  const h = diffMin / 60;
  if (h < 24) return `${h.toFixed(1)}h ago`;
  return `${(h / 24).toFixed(1)}d ago`;
}

export function isStale(latestBucketISO, thresholdHours = 2) {
  if (!latestBucketISO) return false;
  const t = new Date(latestBucketISO).getTime();
  if (Number.isNaN(t)) return false;
  return (Date.now() - t) / 3600000 > thresholdHours;
}

/** The 2026-08-22 heat-formula series break. */
export const SERIES_BREAK_ISO = "2026-08-22T00:00:00+00:00";
export const SERIES_BREAK_MS = new Date(SERIES_BREAK_ISO).getTime();

export function spansSeriesBreak(entries) {
  if (!entries || entries.length < 2) return false;
  const first = new Date(entries[0].bucket_ts).getTime();
  const last = new Date(entries[entries.length - 1].bucket_ts).getTime();
  return Math.min(first, last) < SERIES_BREAK_MS && Math.max(first, last) >= SERIES_BREAK_MS;
}

export function statusLabel(s) {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function safeName(t) {
  if (!t) return "Unnamed topic";
  if (t.name) return t.name;
  return `Topic #${t.topic_id}`;
}
