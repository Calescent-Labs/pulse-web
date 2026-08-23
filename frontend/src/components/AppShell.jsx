import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Activity, AlertTriangle } from "lucide-react";
import { useHealth } from "../lib/queries";
import { useTier } from "../lib/tierContext";
import { formatRelativeFromISO, isStale } from "../lib/format";
import { Disclaimer } from "./Disclaimer";

function TierToggle() {
  const { tier, setTier, devToggleEnabled, hasProKey } = useTier();
  if (!devToggleEnabled) return null;
  return (
    <div
      data-testid="tier-toggle"
      className="inline-flex items-center rounded-sm border hairline bg-background/60 mono text-[10px] uppercase tracking-[0.16em]"
      title="Dev-only tier switch. Gating is enforced server-side."
    >
      <button
        data-testid="tier-free"
        onClick={() => setTier("free")}
        className={`px-2 py-1 transition-colors ${
          tier === "free" ? "bg-secondary text-neutral-100" : "text-muted-foreground hover:text-neutral-200"
        }`}
      >
        Free
      </button>
      <button
        data-testid="tier-pro"
        onClick={() => setTier("pro")}
        disabled={!hasProKey}
        className={`px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          tier === "pro" ? "bg-secondary text-neutral-100" : "text-muted-foreground hover:text-neutral-200"
        }`}
      >
        Pro
      </button>
    </div>
  );
}

function HealthIndicator() {
  const { data, isError } = useHealth();
  const bucket = data?.latest_heat_bucket;
  const stale = isStale(bucket);
  const ok = data?.status === "ok" && !stale;
  return (
    <div
      data-testid="health-indicator"
      className={`hidden sm:inline-flex items-center gap-2 rounded-sm border hairline px-2 py-1 mono text-[10px] uppercase tracking-widest ${
        isError ? "text-destructive" : stale ? "text-amber-300" : "text-neutral-300"
      }`}
      title={
        isError
          ? "Health endpoint unreachable"
          : stale
          ? "Pipeline is behind — data may not be current"
          : "Data pipeline healthy"
      }
    >
      {isError || stale ? <AlertTriangle className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
      <span>{isError ? "offline" : stale ? "stale" : "live"}</span>
      <span className="text-neutral-500">·</span>
      <span className="text-neutral-200">as of {bucket ? formatRelativeFromISO(bucket) : "—"}</span>
    </div>
  );
}

const NAV = [
  { to: "/map", label: "Map", id: "nav-map" },
  { to: "/trending", label: "Trending", id: "nav-trending" },
];

export function AppShell({ children, disclaimer, dense = false }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header
        data-testid="app-header"
        className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b hairline bg-background/85 px-4 py-2.5 backdrop-blur"
      >
        <div className="flex items-center gap-5">
          <Link
            to="/"
            data-testid="brand-link"
            className="inline-flex items-baseline gap-2 no-underline"
          >
            <span
              className="text-lg font-semibold tracking-tight text-neutral-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              Pulse
            </span>
            <span className="hidden sm:inline mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Calescent Labs
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={n.id}
                className={({ isActive }) =>
                  `rounded-sm px-2.5 py-1 mono text-[11px] uppercase tracking-[0.16em] transition-colors ${
                    isActive
                      ? "bg-secondary text-neutral-100"
                      : "text-muted-foreground hover:text-neutral-200"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <HealthIndicator />
          <TierToggle />
        </div>
      </header>

      <main
        data-testid="app-main"
        className={`flex-1 ${dense ? "" : "px-4 py-6 sm:px-6 sm:py-8"}`}
      >
        {children}
      </main>

      <Disclaimer text={disclaimer} />
    </div>
  );
}
