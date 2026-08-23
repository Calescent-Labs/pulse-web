import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, MapPin, X } from "lucide-react";
import { HeatBadge } from "./HeatBadge";
import { formatCompact, safeName } from "../lib/format";

/**
 * RegionPanel — "what is actually inside this region" side sheet.
 *
 * Consumes GET /v1/map/region. Coherence is the mean cosine of member
 * embeddings to the region centroid, computed server-side. `coherent`
 * is that value against the server's 0.5 threshold — when false, the
 * region is a coincidental spatial adjacency rather than one story,
 * and the UI must say so plainly.
 */
export function RegionPanel({ center, query, onClose }) {
  const isLoading = query?.isLoading;
  const isError = query?.isError;
  const err = query?.error;
  const data = query?.data?.data;

  const memberCount = data?.member_count ?? 0;
  const coherence = data?.coherence;
  const coherent = data?.coherent;
  const unclustered = data?.unclustered_members ?? 0;
  const topics = data?.topics || [];
  const note = query?.data?.data?.note;

  return (
    <aside
      data-testid="region-panel"
      className="pointer-events-auto absolute right-0 top-0 z-20 h-full w-[336px] max-w-full border-l hairline bg-background/95 backdrop-blur-md shadow-2xl overflow-y-auto"
    >
      <header className="flex items-start justify-between gap-2 border-b hairline p-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            region
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-100">
            <MapPin className="h-3 w-3 text-[hsl(25,95%,60%)]" />
            <span className="mono text-[11px] text-neutral-200">
              {center?.x != null ? center.x.toFixed(2) : "—"},{" "}
              {center?.y != null ? center.y.toFixed(2) : "—"}
            </span>
            <span className="mono text-[10px] text-neutral-500">· r={center?.radius ?? 1.0}</span>
          </div>
        </div>
        <button
          type="button"
          data-testid="region-panel-close"
          onClick={onClose}
          className="rounded-sm border hairline bg-background/60 p-1 text-muted-foreground hover:bg-secondary hover:text-neutral-100"
          title="Close"
        >
          <X className="h-3 w-3" />
        </button>
      </header>

      {isLoading ? (
        <div className="p-4">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            investigating…
          </div>
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-sm border hairline bg-secondary/20 animate-pulse" />
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="p-4">
          <div className="mono text-[10px] uppercase tracking-widest text-[hsl(0,80%,60%)]">
            region unavailable
          </div>
          <p className="mt-2 text-xs text-neutral-400">{err?.message || "Try clicking a different area."}</p>
        </div>
      ) : memberCount === 0 ? (
        <div className="p-4">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            nothing here
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            {note ||
              "No content within this radius. Try a hotter area, or a slightly larger radius."}
          </p>
        </div>
      ) : (
        <div className="space-y-4 p-3">
          {/* Coherence read — the non-negotiable honesty gate. */}
          <div
            data-testid="region-coherence"
            className={`rounded-sm border hairline p-3 ${
              coherent
                ? "border-[hsl(140,55%,50%)]/30 bg-[hsl(140,55%,50%)]/5"
                : "border-[hsl(30,90%,55%)]/40 bg-[hsl(30,90%,55%)]/5"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                coherence
              </span>
              <span
                className={`mono text-[11px] font-medium ${
                  coherent ? "text-[hsl(140,55%,68%)]" : "text-[hsl(30,90%,68%)]"
                }`}
              >
                {typeof coherence === "number" ? coherence.toFixed(2) : "—"}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
              <div
                className={`h-full ${
                  coherent ? "bg-[hsl(140,55%,55%)]" : "bg-[hsl(30,90%,60%)]"
                }`}
                style={{
                  width: `${Math.max(0, Math.min(1, coherence || 0)) * 100}%`,
                  transition: "width 300ms ease",
                }}
              />
              {/* Threshold tick at 0.5 */}
              <div className="relative -mt-1.5 h-1.5">
                <div
                  className="absolute top-0 h-1.5 w-px bg-neutral-500"
                  style={{ left: "50%" }}
                  title="Coherence threshold: 0.5"
                />
              </div>
            </div>
            <p
              className={`mt-2 text-xs leading-relaxed ${
                coherent ? "text-[hsl(140,45%,80%)]" : "text-[hsl(30,80%,80%)]"
              }`}
            >
              {coherent ? (
                <>
                  <strong className="text-neutral-100">One story.</strong> Members cluster tightly
                  around the same theme.
                </>
              ) : (
                <span className="inline-flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    <strong className="text-neutral-100">Coincidental adjacency.</strong> The topics
                    below happen to share this region but do not form a single story.
                  </span>
                </span>
              )}
            </p>
          </div>

          {/* Region stats */}
          <div className="grid grid-cols-2 gap-2 mono text-[10px] uppercase tracking-widest">
            <div className="rounded-sm border hairline bg-background/50 p-2">
              <div className="text-muted-foreground">members</div>
              <div className="mt-1 text-base font-medium text-neutral-100">
                {formatCompact(memberCount)}
              </div>
            </div>
            <div className="rounded-sm border hairline bg-background/50 p-2">
              <div className="text-muted-foreground">unclustered</div>
              <div className="mt-1 text-base font-medium text-neutral-100">
                {formatCompact(unclustered)}
              </div>
              <div className="mt-0.5 text-[9px] normal-case text-neutral-500">
                {memberCount > 0
                  ? `${Math.round((unclustered / memberCount) * 100)}% of the region belongs to no topic`
                  : ""}
              </div>
            </div>
          </div>

          {/* Top topics in the region */}
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              top topics · by in-region count
            </div>
            <ul data-testid="region-topics" className="mt-2 space-y-1.5">
              {topics.length === 0 ? (
                <li className="text-xs text-neutral-500">
                  Every signal here is unclustered — no topic dominates.
                </li>
              ) : (
                topics.map((t) => (
                  <li key={t.topic_id}>
                    <Link
                      to={`/topic/${t.topic_id}`}
                      data-testid={`region-topic-${t.topic_id}`}
                      className="group flex items-start justify-between gap-3 rounded-sm border hairline bg-background/40 p-2.5 no-underline transition-colors hover:bg-secondary/40"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-neutral-100 group-hover:text-white truncate">
                          {safeName(t)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {t.sector && <span>{t.sector}</span>}
                          {t.sector && <span>·</span>}
                          <span className="text-neutral-300">
                            {t.member_count_in_region} here
                          </span>
                        </div>
                      </div>
                      <HeatBadge
                        percentile={t.heat_percentile}
                        confidence={t.heat_confidence}
                        size="sm"
                      />
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </aside>
  );
}
