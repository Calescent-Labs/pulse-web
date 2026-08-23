import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, PanelRightClose, PanelRightOpen } from "lucide-react";
import { HeatBadge } from "./HeatBadge";
import { StatusChip } from "./StatusChip";
import { formatCompact, safeName } from "../lib/format";

/**
 * SignalsPanel — right-side list of topics whose signals are inside the
 * current map viewport. Answers "what am I looking at?" without exposing
 * per-signal channel/platform data.
 *
 * Props:
 *   visibleTopics: Array<{ topic, countInView, hasHeat }>
 *   visibleNoiseCount: number
 *   sort: 'count' | 'heat'
 *   onSortChange: (s) => void
 *   open: boolean
 *   onToggle: () => void
 *   loading: boolean
 */
export function SignalsPanel({
  visibleTopics,
  visibleNoiseCount,
  sort,
  onSortChange,
  open,
  onToggle,
  loading,
}) {
  if (!open) {
    return (
      <button
        data-testid="signals-panel-open"
        onClick={onToggle}
        className="pointer-events-auto absolute right-3 top-32 z-10 inline-flex items-center gap-1.5 rounded-sm border hairline bg-background/85 px-2.5 py-1.5 mono text-[11px] uppercase tracking-widest text-neutral-200 backdrop-blur transition-colors hover:bg-secondary"
        title="Show signals in this view"
      >
        <PanelRightOpen className="h-3 w-3" />
        signals
      </button>
    );
  }

  const total = visibleTopics.length + (visibleNoiseCount > 0 ? 1 : 0);

  return (
    <aside
      data-testid="signals-panel"
      className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-full max-w-[340px] flex-col border-l hairline bg-background/95 backdrop-blur"
    >
      <div className="flex items-center justify-between border-b hairline px-3 py-2.5">
        <div className="min-w-0">
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Signals in view
          </div>
          <div className="mt-0.5 mono text-[10px] text-neutral-500">
            {loading
              ? "reading viewport…"
              : `${visibleTopics.length} named ${visibleTopics.length === 1 ? "topic" : "topics"}${
                  visibleNoiseCount > 0 ? ` · ${formatCompact(visibleNoiseCount)} unnamed` : ""
                }`}
          </div>
        </div>
        <button
          data-testid="signals-panel-close"
          onClick={onToggle}
          className="rounded-sm p-1 text-muted-foreground hover:bg-secondary hover:text-neutral-100"
          title="Hide panel"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-1 border-b hairline px-3 py-1.5">
        <span className="mr-1 mono text-[10px] uppercase tracking-widest text-muted-foreground">
          sort
        </span>
        {[
          { v: "count", label: "in view" },
          { v: "heat", label: "heat" },
        ].map((o) => (
          <button
            key={o.v}
            data-testid={`sort-${o.v}`}
            onClick={() => onSortChange(o.v)}
            className={`rounded-sm px-2 py-0.5 mono text-[10px] uppercase tracking-widest transition-colors ${
              sort === o.v
                ? "bg-secondary text-neutral-100"
                : "text-muted-foreground hover:text-neutral-100"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* List */}
      <ol data-testid="signals-list" className="flex-1 overflow-auto">
        {visibleTopics.length === 0 && !loading && (
          <li className="p-4 text-center text-xs text-muted-foreground">
            Nothing named in this view — try zooming out or panning to a hot region.
          </li>
        )}
        {visibleTopics.map((row, i) => {
          const t = row.topic;
          return (
            <li
              key={t.topic_id}
              data-testid={`signal-row-${t.topic_id}`}
              className="border-b hairline"
            >
              <Link
                to={`/topic/${t.topic_id}`}
                className="group flex items-start gap-3 px-3 py-2.5 no-underline hover:bg-secondary/40"
              >
                <div className="mono w-5 text-right text-[10px] text-muted-foreground">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-neutral-100 group-hover:text-white">
                    {safeName(t)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    {t.status && <StatusChip status={t.status} />}
                    {t.sector && (
                      <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t.sector}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <HeatBadge
                      percentile={t.heat_percentile}
                      confidence={t.heat_confidence}
                      size="sm"
                    />
                    <span
                      className="mono text-[10px] uppercase tracking-widest text-neutral-300"
                      title={`${row.countInView} signals from this topic inside the current view`}
                    >
                      <span className="text-neutral-100">{row.countInView}</span> in view
                    </span>
                  </div>
                </div>
                <ChevronRight className="mt-1 h-3 w-3 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="border-t hairline px-3 py-2 mono text-[9px] uppercase tracking-widest text-neutral-500">
        Pan or zoom the map — this list updates to match what's visible.
      </div>
    </aside>
  );
}
