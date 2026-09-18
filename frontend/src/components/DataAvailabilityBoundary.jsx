import React, { useEffect, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "./AppShell";
import { useHealth } from "../lib/queries";
import {
  clearLegacyTimelapse, healthPausesData, isAnalyticalQuery,
  isDataPaused, markDataPaused, subscribeDataAvailability,
} from "../lib/dataAvailability";

export function DataAvailabilityBoundary({ children }) {
  const health = useHealth();
  const client = useQueryClient();
  const { pathname } = useLocation();
  const latched = useSyncExternalStore(subscribeDataAvailability, isDataPaused, isDataPaused);
  const paused = latched || healthPausesData(health.data);
  const checking = !paused && health.isPending;
  const unavailable = paused || health.isError || !health.data || health.data.status !== "ok";

  useEffect(() => { clearLegacyTimelapse(); }, []);
  useEffect(() => {
    if (!paused) return;
    markDataPaused();
    // Unmount data surfaces before cancelling requests and discarding results.
    void client.cancelQueries({ predicate: isAnalyticalQuery }).then(() => {
      client.removeQueries({ predicate: isAnalyticalQuery });
    });
  }, [paused, client]);

  // Account and navigation chrome remain available independently of analytics.
  if (pathname === "/upgrade" || (!checking && !unavailable)) return children;

  const home = pathname === "/";
  return (
    <AppShell disclaimer="Live and historical data are temporarily unavailable.">
      <section data-testid="data-availability" className="mx-auto max-w-4xl py-16 sm:py-24">
        <p className="mono text-xs uppercase tracking-widest text-[hsl(25,95%,60%)]">
          Pulse · Calescent Labs
        </p>
        <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-50">
          {home ? "The internet, before it's obvious." : "Explore Pulse"}
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-neutral-300">
          Pulse is being built to help you explore where attention is growing online.
        </p>
        <div role="status" className="mt-8 rounded-sm border hairline bg-secondary/30 p-6">
          <h2 className="text-lg font-medium text-neutral-100">
            {checking ? "Checking data availability…" :
              paused ? "Live and historical data are temporarily unavailable" :
                "We couldn't connect to the data service"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-300">
            {checking ? "The site is loading. Navigation and account access remain available." :
              paused ? "We're updating our data coverage. Maps, trends and historical topic details are paused. You can still navigate the site and access your account." :
                "Please try again shortly. Navigation and account access remain available."}
          </p>
          {!checking && (
            <button type="button" onClick={() => window.location.reload()}
              className="mt-4 rounded-sm border hairline px-4 py-2 text-sm text-neutral-100">
              Check again
            </button>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-5 text-sm text-neutral-200">
          <Link to="/">Home</Link>
          <Link to="/map">Map</Link>
          <Link to="/trending">Trending</Link>
        </div>
      </section>
    </AppShell>
  );
}
