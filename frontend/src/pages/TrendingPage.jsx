import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { HeatBadge } from "../components/HeatBadge";
import { SentimentIndicator } from "../components/SentimentIndicator";
import { Sparkline } from "../components/Sparkline";
import { StatusChip } from "../components/StatusChip";
import { LockedFeature } from "../components/LockedFeature";
import { ErrorState } from "../components/ErrorState";
import { NoKeyState } from "../components/NoKeyState";
import { useSectors, useTopics } from "../lib/queries";
import { useTier } from "../lib/tierContext";
import { formatCompact, safeName } from "../lib/format";

function SectorFilter({ value, onChange }) {
  const { tier } = useTier();
  const { data, error } = useSectors();
  const [open, setOpen] = useState(false);

  if (tier === "free" || (error && error.code === 402)) {
    return (
      <div data-testid="sector-filter-locked">
        <LockedFeature feature="sector filter" compact />
      </div>
    );
  }
  if (error) return <ErrorState error={error} title="Sectors unavailable" />;
  const sectors = data?.data || [];

  return (
    <div className="relative">
      <button
        data-testid="sector-filter"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-sm border hairline bg-background/60 px-2.5 py-1.5 mono text-[11px] uppercase tracking-widest text-neutral-200 hover:bg-secondary"
      >
        <span className="text-muted-foreground">sector</span>
        <span>{value || "all"}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 min-w-40 rounded-sm border hairline bg-background/95 p-1 backdrop-blur">
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className="block w-full rounded-sm px-2 py-1 text-left mono text-[11px] uppercase tracking-widest text-neutral-200 hover:bg-secondary"
          >
            all
          </button>
          {sectors.map((s) => (
            <button
              key={s.sector}
              onClick={() => { onChange(s.sector); setOpen(false); }}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-left mono text-[11px] uppercase tracking-widest text-neutral-200 hover:bg-secondary"
            >
              <span>{s.sector}</span>
              <span className="text-muted-foreground">{s.topic_count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TopicRow({ topic, rank }) {
  const spark = useMemo(() => {
    // We don't have per-topic history in the ranked feed — sparkline is
    // populated on Topic Detail. Here we render an inert placeholder so the
    // row stays honest about what we know.
    return null;
  }, []);

  return (
    <li
      data-testid={`topic-row-${topic.topic_id}`}
      className="grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b hairline px-3 py-3 hover:bg-secondary/30 sm:grid-cols-[36px_1fr_120px_160px_120px_auto] sm:gap-4"
    >
      <div className="mono text-xs text-muted-foreground text-right">#{rank}</div>
      <div className="min-w-0">
        <Link
          to={`/topic/${topic.topic_id}`}
          data-testid={`topic-link-${topic.topic_id}`}
          className="block truncate text-sm font-medium text-neutral-50 no-underline hover:text-white"
        >
          {safeName(topic)}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusChip status={topic.status} />
          {topic.sector && (
            <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {topic.sector}{topic.subsector ? ` · ${topic.subsector}` : ""}
            </span>
          )}
          <span className="mono text-[10px] text-muted-foreground">
            {formatCompact(topic.member_count)} items
          </span>
        </div>
      </div>
      <div className="hidden sm:block">
        <HeatBadge percentile={topic.heat_percentile} confidence={topic.heat_confidence} />
      </div>
      <div className="hidden sm:block">
        <SentimentIndicator
          mean={topic.sentiment?.mean}
          polarisation={topic.sentiment?.polarisation}
          sampleSize={topic.sentiment?.sample_size}
        />
      </div>
      <div className="hidden sm:block">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">velocity</div>
        <div className="mono text-xs text-neutral-100">
          {topic.signals?.velocity != null ? topic.signals.velocity.toFixed(4) : "—"}
        </div>
      </div>
      <div className="col-span-3 flex items-center justify-between sm:col-auto sm:justify-end">
        {/* Mobile summary: heat + sentiment inline */}
        <div className="flex items-center gap-3 sm:hidden">
          <HeatBadge
            percentile={topic.heat_percentile}
            confidence={topic.heat_confidence}
            size="sm"
          />
          <SentimentIndicator
            mean={topic.sentiment?.mean}
            polarisation={topic.sentiment?.polarisation}
            sampleSize={topic.sentiment?.sample_size}
            size="sm"
          />
        </div>
        <div className="text-neutral-500">{spark}</div>
      </div>
    </li>
  );
}

export default function TrendingPage() {
  const [sector, setSector] = useState("");
  const [minConf, setMinConf] = useState(0);

  const q = useTopics({
    limit: 50,
    sector: sector || undefined,
    min_confidence: minConf || undefined,
  });

  const topics = q.data?.data || [];
  const disclaimer = q.data?.meta?.disclaimer;
  const hasKey = Boolean(process.env.REACT_APP_PULSE_KEY_FREE);

  return (
    <AppShell disclaimer={disclaimer}>
      <div data-testid="trending-page" className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Ranked feed
            </div>
            <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-50" style={{ letterSpacing: "-0.02em" }}>
              Trending Now
            </h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-400">
              Topics ordered by heat. Every score ships with its confidence — a
              provisional-looking number is provisional.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SectorFilter value={sector} onChange={setSector} />
            <div className="inline-flex items-center gap-2 rounded-sm border hairline bg-background/60 px-2.5 py-1.5">
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                min conf
              </span>
              <input
                data-testid="min-confidence"
                type="range"
                min={0}
                max={95}
                step={5}
                value={minConf * 100}
                onChange={(e) => setMinConf(Number(e.target.value) / 100)}
                className="scrubber w-24"
              />
              <span className="mono text-xs text-neutral-100 w-8 text-right">
                {Math.round(minConf * 100)}%
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-sm border hairline bg-background/40">
          {/* Header row */}
          <div
            className="hidden sm:grid grid-cols-[36px_1fr_120px_160px_120px_auto] items-center gap-4 border-b hairline px-3 py-2 mono text-[10px] uppercase tracking-widest text-muted-foreground"
            aria-hidden="true"
          >
            <div className="text-right">#</div>
            <div>Topic</div>
            <div>Heat · Conf</div>
            <div>Sentiment</div>
            <div>Velocity</div>
            <div />
          </div>

          {!hasKey ? (
            <div className="p-4"><NoKeyState /></div>
          ) : q.isError ? (
            <div className="p-4"><ErrorState error={q.error} /></div>
          ) : q.isLoading ? (
            <div className="p-6 text-center mono text-xs text-muted-foreground">
              loading ranked topics…
            </div>
          ) : topics.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No topics match these filters.
            </div>
          ) : (
            <ol data-testid="topics-list">
              {topics.map((t, i) => (
                <TopicRow key={t.topic_id} topic={t} rank={i + 1} />
              ))}
            </ol>
          )}
        </div>
      </div>
    </AppShell>
  );
}
