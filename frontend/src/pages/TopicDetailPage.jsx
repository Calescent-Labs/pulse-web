import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Lock, AlertTriangle, GitCompare, Pin, X as XIcon } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { AppShell } from "../components/AppShell";
import { BlurredSection } from "../components/BlurredSection";
import { ClosenessRadar } from "../components/ClosenessRadar";
import { HeatBadge } from "../components/HeatBadge";
import { SentimentIndicator } from "../components/SentimentIndicator";
import { StatusChip } from "../components/StatusChip";
import { LockedFeature } from "../components/LockedFeature";
import { ErrorState } from "../components/ErrorState";
import { NoKeyState } from "../components/NoKeyState";
import { useNeighbours, useTopic } from "../lib/queries";
import { useTier } from "../lib/tierContext";
import {
  formatCompact, formatConfidence, formatPercentile, formatRelativeFromISO,
  formatSigned, safeName, spansSeriesBreak, SERIES_BREAK_ISO, SERIES_BREAK_MS,
} from "../lib/format";

const HISTORY_PRESETS = [
  { hours: 24, label: "24h", pro: false },
  { hours: 72, label: "72h", pro: true },
  { hours: 168, label: "7d", pro: true },
  { hours: 720, label: "30d", pro: true },
];

function ChartCard({ title, note, children }) {
  return (
    <section className="rounded-sm border hairline bg-background/40 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
        {note && <span className="mono text-[10px] text-neutral-500">{note}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const COMPARE_COLORS = {
  origin: "hsl(220, 8%, 78%)",
  a: "hsl(25, 95%, 60%)",
  b: "hsl(268, 65%, 65%)",
};

function ComparePanel({
  origin, originHistory, compareA, compareB, loadingA, loadingB,
  onClearA, onClearB, onClearAll,
}) {
  // Merge histories by bucket timestamp so recharts can plot them together.
  const merged = useMemo(() => {
    const map = new Map();
    const put = (hist, key) => {
      (hist || []).forEach((h) => {
        if (!h || !h.bucket_ts) return;
        const t = new Date(h.bucket_ts).getTime();
        if (Number.isNaN(t)) return;
        if (!map.has(t)) map.set(t, { ts: t });
        map.get(t)[key] = h.velocity;
      });
    };
    put(originHistory, "v_origin");
    put(compareA?.history, "v_a");
    put(compareB?.history, "v_b");
    return Array.from(map.values()).sort((x, y) => x.ts - y.ts);
  }, [originHistory, compareA, compareB]);

  const tickFmt = (t) => {
    const d = new Date(t);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}:00`;
  };

  const Chip = ({ color, label, onClear, loading, testid }) => (
    <span
      data-testid={testid}
      className="inline-flex items-center gap-1.5 rounded-sm border hairline bg-background/70 px-2 py-0.5 mono text-[10px] uppercase tracking-widest text-neutral-200"
    >
      <span className="inline-block h-0.5 w-4 rounded-sm" style={{ background: color }} />
      <span className="max-w-[140px] truncate normal-case tracking-normal">{label || "…"}</span>
      {loading && <span className="text-muted-foreground">loading</span>}
      {onClear && (
        <button
          onClick={onClear}
          className="ml-1 rounded-sm text-muted-foreground hover:text-neutral-100"
          title="Unpin"
        >
          <XIcon className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );

  return (
    <div
      data-testid="compare-panel"
      className="mt-4 rounded-sm border hairline bg-secondary/20 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          compare · 24h velocity
        </span>
        <Chip color={COMPARE_COLORS.origin} label={origin?.name || `Topic #${origin?.topic_id}`} testid="compare-chip-origin" />
        {compareA && (
          <Chip color={COMPARE_COLORS.a} label={compareA.name || `Topic #${compareA.topic_id}`} onClear={onClearA} testid="compare-chip-a" />
        )}
        {!compareA && loadingA && <Chip color={COMPARE_COLORS.a} label="loading" loading testid="compare-chip-a" />}
        {compareB && (
          <Chip color={COMPARE_COLORS.b} label={compareB.name || `Topic #${compareB.topic_id}`} onClear={onClearB} testid="compare-chip-b" />
        )}
        {!compareB && loadingB && <Chip color={COMPARE_COLORS.b} label="loading" loading testid="compare-chip-b" />}
        <button
          data-testid="compare-clear-all"
          onClick={onClearAll}
          className="ml-auto mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-neutral-100"
        >
          clear
        </button>
      </div>
      <div className="mt-2 h-40 w-full">
        <ResponsiveContainer>
          <LineChart data={merged} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={tickFmt}
              tick={{ fill: "hsl(220 8% 58%)", fontSize: 10, fontFamily: "IBM Plex Mono" }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "hsl(220 8% 58%)", fontSize: 10, fontFamily: "IBM Plex Mono" }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              tickLine={false}
              width={38}
            />
            <Tooltip
              contentStyle={{ background: "#0e1117", border: "1px solid #2a2f3a", fontFamily: "IBM Plex Mono", fontSize: 11 }}
              labelFormatter={(v) => new Date(v).toUTCString()}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
            <Line type="monotone" dataKey="v_origin" stroke={COMPARE_COLORS.origin} strokeWidth={1.25} dot={false} connectNulls={false} />
            {compareA && (
              <Line type="monotone" dataKey="v_a" stroke={COMPARE_COLORS.a} strokeWidth={1.5} dot={false} connectNulls={false} />
            )}
            {compareB && (
              <Line type="monotone" dataKey="v_b" stroke={COMPARE_COLORS.b} strokeWidth={1.5} dot={false} connectNulls={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MetricCell({ label, value, sub }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mono mt-0.5 text-sm text-neutral-100">{value}</div>
      {sub && <div className="mono text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function TopicDetailPage() {
  const { id } = useParams();
  const topicId = Number(id);
  const { tier } = useTier();
  const isFree = tier !== "pro";

  const [historyHours, setHistoryHours] = useState(24);
  const q = useTopic({ topicId, history_hours: historyHours, members: 50 });
  const neighboursQ = useNeighbours({ topicId, limit: 6 });

  // Compare tray — up to two pinned neighbours. Origin topic is always
  // included as the baseline line, so the panel becomes a real research
  // surface: "does this neighbour lead, follow, or diverge from us?"
  const [compareIds, setCompareIds] = useState([]);
  useEffect(() => {
    // Reset the tray when the origin topic changes.
    setCompareIds([]);
  }, [topicId]);
  const compareA = useTopic({
    topicId: compareIds[0] != null ? compareIds[0] : NaN,
    history_hours: 24,
    members: 0,
  });
  const compareB = useTopic({
    topicId: compareIds[1] != null ? compareIds[1] : NaN,
    history_hours: 24,
    members: 0,
  });

  const togglePin = (nid) => {
    setCompareIds((cur) => {
      if (cur.includes(nid)) return cur.filter((x) => x !== nid);
      if (cur.length >= 2) return [cur[1], nid]; // rolling window
      return [...cur, nid];
    });
  };

  const topic = q.data?.data || null;
  const history = topic?.history || [];
  const members = topic?.members || [];
  const disclaimer = q.data?.meta?.disclaimer;

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        ts: new Date(h.bucket_ts).getTime(),
        heat: h.heat_percentile,
        conf: h.heat_confidence,
        velocity: h.velocity,
        acceleration: h.acceleration,
        sentiment: h.sentiment,
      })),
    [history],
  );
  const showBreakLine = spansSeriesBreak(history);

  const tickFmt = (t) => {
    const d = new Date(t);
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}:00`;
  };

  return (
    <AppShell disclaimer={disclaimer}>
      <div data-testid="topic-detail-page" className="mx-auto max-w-5xl">
        <div className="mb-4">
          <Link to="/trending" className="mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-neutral-100">
            ← trending
          </Link>
        </div>

        {q.isError ? (
          <ErrorState error={q.error} title="Topic unavailable" />
        ) : !process.env.REACT_APP_PULSE_KEY_FREE ? (
          <NoKeyState />
        ) : q.isLoading || !topic ? (
          <div className="mono text-xs text-muted-foreground">loading topic…</div>
        ) : (
          <>
            <header className="border-b hairline pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={topic.status} />
                {topic.sector && (
                  <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {topic.sector}{topic.subsector ? ` · ${topic.subsector}` : ""}
                  </span>
                )}
                <span className="mono text-[10px] text-muted-foreground">
                  as of {formatRelativeFromISO(topic.as_of)}
                </span>
              </div>
              <h1
                className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-neutral-50"
                style={{ letterSpacing: "-0.02em" }}
                data-testid="topic-name"
              >
                {safeName(topic)}
              </h1>
              {topic.summary && (
                <BlurredSection active={isFree} className="mt-3 max-w-3xl">
                  <p className="text-sm sm:text-base leading-relaxed text-neutral-300">
                    {topic.summary}
                  </p>
                </BlurredSection>
              )}
              {topic.entities && topic.entities.length > 0 && (
                <BlurredSection active={isFree} className="mt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {topic.entities.map((e) => (
                      <span
                        key={e}
                        className="rounded-sm border hairline bg-secondary/40 px-2 py-0.5 mono text-[10px] uppercase tracking-widest text-neutral-200"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </BlurredSection>
              )}
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="col-span-2 sm:col-span-1">
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Heat · Confidence
                  </div>
                  <div className="mt-1">
                    <HeatBadge percentile={topic.heat_percentile} confidence={topic.heat_confidence} size="lg" />
                  </div>
                </div>
                <MetricCell label="Velocity" value={formatSigned(topic.signals?.velocity, 4)} />
                <BlurredSection active={isFree}>
                  <MetricCell label="Acceleration" value={formatSigned(topic.signals?.acceleration, 4)} />
                </BlurredSection>
                <BlurredSection active={isFree}>
                  <MetricCell label="Breadth" value={topic.signals?.breadth ?? "—"} sub="channels" />
                </BlurredSection>
                <BlurredSection active={isFree}>
                  <MetricCell label="Freshness" value={formatConfidence(topic.signals?.freshness)} />
                </BlurredSection>
              </div>
            </header>

            {/* History range selector, series-break, and the first arc chart
                are visible on Free — the "shape of the arc" answer. Depth
                (heat percentile, sentiment, members, related topics) stays
                Pro-gated below. */}
            {/* History range selector */}
            <div className="my-4 flex flex-wrap items-center gap-2">
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">history</span>
              {HISTORY_PRESETS.map((p) => {
                const locked = tier === "free" && p.pro;
                return (
                  <button
                    key={p.hours}
                    data-testid={`history-${p.label}`}
                    onClick={() => !locked && setHistoryHours(p.hours)}
                    disabled={locked}
                    className={`inline-flex items-center gap-1 rounded-sm border hairline px-2 py-1 mono text-[11px] uppercase tracking-widest transition-colors ${
                      historyHours === p.hours
                        ? "bg-secondary text-neutral-50"
                        : locked
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : "text-muted-foreground hover:text-neutral-100"
                    }`}
                    title={locked ? "Extended history is Pro" : `Load last ${p.label}`}
                  >
                    {p.label}
                    {locked && <Lock className="h-2.5 w-2.5" />}
                  </button>
                );
              })}
            </div>

            {q.isError && q.error.code === 402 && (
              <LockedFeature feature="extended history" className="mb-4" />
            )}

            {showBreakLine && (
              <div
                data-testid="series-break-note"
                className="mb-3 flex items-center gap-2 rounded-sm border hairline bg-amber-500/5 px-3 py-2 mono text-[10px] uppercase tracking-widest text-amber-300"
              >
                <AlertTriangle className="h-3 w-3" />
                Series break on 2026-08-22 — rows before that date use a different heat formula.
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title="Velocity & acceleration"
                note="Shape of the arc — percentile can rank-churn hour to hour"
              >
                <div className="h-56 w-full">
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="ts" type="number" domain={["dataMin", "dataMax"]}
                        tickFormatter={tickFmt} tick={{ fill: "hsl(220 8% 58%)", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} minTickGap={40}
                      />
                      <YAxis
                        tick={{ fill: "hsl(220 8% 58%)", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} width={38}
                      />
                      <Tooltip
                        contentStyle={{ background: "#0e1117", border: "1px solid #2a2f3a", fontFamily: "IBM Plex Mono", fontSize: 11 }}
                        labelFormatter={(v) => new Date(v).toUTCString()}
                      />
                      {showBreakLine && (
                        <ReferenceLine x={SERIES_BREAK_MS} stroke="hsl(48 95% 66%)" strokeDasharray="3 3" />
                      )}
                      <Line type="monotone" dataKey="velocity" stroke="hsl(25 95% 60%)" strokeWidth={1.5} dot={false} connectNulls={false} />
                      <Line type="monotone" dataKey="acceleration" stroke="hsl(268 65% 65%)" strokeWidth={1} dot={false} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex items-center gap-4 mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4 bg-[hsl(25,95%,60%)]" />
                    velocity
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4 bg-[hsl(268,65%,65%)]" />
                    acceleration
                  </span>
                </div>
              </ChartCard>
            </div>

            {/* Member content — the "jump in" surface. Stays visible on Free
                tier so the "click any topic and open its content" promise
                actually delivers. Pro depth (percentile charts, sentiment
                trajectory, related topics) remains gated below. */}
            <section
              data-testid="member-content-section"
              className="mt-4 rounded-sm border hairline bg-background/40 p-4"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  The content behind this trend
                </h3>
                <span className="mono text-[10px] text-neutral-500">
                  {members.length} items · removed items stay listed
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                These are the actual pieces of content driving this trend. Open any one to
                consume it at its original source.
              </p>
              <ul data-testid="topic-members" className="mt-3 max-h-72 space-y-2 overflow-auto">
                {members.length === 0 && (
                  <li className="mono text-xs text-muted-foreground">no member content in range</li>
                )}
                {members.map((m) => {
                  const isDead = m.status === "removed" || m.status === "privated";
                  return (
                    <li
                      key={m.url}
                      data-testid={`member-${m.status}`}
                      className={`group flex items-start gap-2 rounded-sm border hairline px-3 py-2.5 transition-colors ${
                        isDead ? "opacity-60" : "hover:bg-secondary/40 hover:border-[hsl(25,95%,60%)]/30"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`member-title-${m.status}`}
                          className={`block truncate text-sm no-underline ${
                            isDead
                              ? "text-neutral-400 line-through"
                              : "text-neutral-100 hover:text-white"
                          }`}
                        >
                          {m.title}
                        </a>
                        <div className="mt-0.5 mono text-[10px] text-muted-foreground">
                          {m.channel} · {formatRelativeFromISO(m.published_at)} · {formatCompact(m.views)} views
                          {m.status !== "live" && (
                            <span className="ml-1 rounded-sm border hairline px-1 py-0.5 heat-3 uppercase tracking-widest">
                              {m.status}
                            </span>
                          )}
                        </div>
                      </div>
                      {isDead ? (
                        <span
                          className="ml-1 flex-shrink-0 mono text-[9px] uppercase tracking-widest text-neutral-500"
                          title="This content was removed or made private at the source"
                        >
                          unavailable
                        </span>
                      ) : (
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`member-open-${m.status}`}
                          className="ml-1 inline-flex flex-shrink-0 items-center gap-1.5 rounded-sm border hairline bg-[hsl(25,95%,60%)]/10 px-3 py-1.5 mono text-[10px] uppercase tracking-widest text-[hsl(25,95%,72%)] no-underline transition-colors hover:bg-[hsl(25,95%,60%)]/20 hover:text-[hsl(25,95%,80%)]"
                          title="Open at source"
                        >
                          open source
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 mono text-[10px] uppercase tracking-widest text-neutral-500">
                ranked by how much they're contributing to this topic's heat right now
              </p>
            </section>

            {/* Historical depth — Pro-gated */}
            <BlurredSection active={isFree} sticky label="Historical depth · Coming with Pro">
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">

              <ChartCard title="Heat percentile" note="A rank, not a smooth trend">
                <div className="h-56 w-full">
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="ts" type="number" domain={["dataMin", "dataMax"]}
                        tickFormatter={tickFmt} tick={{ fill: "hsl(220 8% 58%)", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} minTickGap={40}
                      />
                      <YAxis
                        domain={[0, 1]} tickFormatter={(v) => `P${Math.round(v * 100)}`}
                        tick={{ fill: "hsl(220 8% 58%)", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} width={40}
                      />
                      <Tooltip
                        contentStyle={{ background: "#0e1117", border: "1px solid #2a2f3a", fontFamily: "IBM Plex Mono", fontSize: 11 }}
                        labelFormatter={(v) => new Date(v).toUTCString()}
                        formatter={(v, k) => (k === "heat" ? formatPercentile(v) : k === "conf" ? formatConfidence(v) : v)}
                      />
                      {showBreakLine && (
                        <ReferenceLine x={SERIES_BREAK_MS} stroke="hsl(48 95% 66%)" strokeDasharray="3 3" />
                      )}
                      <Line type="monotone" dataKey="heat" stroke="hsl(18 92% 60%)" strokeWidth={1.5} dot={false} connectNulls={false} />
                      <Line type="monotone" dataKey="conf" stroke="hsl(220 8% 55%)" strokeWidth={1} strokeDasharray="3 3" dot={false} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Sentiment trajectory" note="Range −1 to +1 · gaps mean no comments">
                <div className="h-40 w-full">
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="ts" type="number" domain={["dataMin", "dataMax"]}
                        tickFormatter={tickFmt} tick={{ fill: "hsl(220 8% 58%)", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} minTickGap={40}
                      />
                      <YAxis
                        domain={[-1, 1]} tick={{ fill: "hsl(220 8% 58%)", fontSize: 10, fontFamily: "IBM Plex Mono" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} width={38}
                      />
                      <Tooltip
                        contentStyle={{ background: "#0e1117", border: "1px solid #2a2f3a", fontFamily: "IBM Plex Mono", fontSize: 11 }}
                        labelFormatter={(v) => new Date(v).toUTCString()}
                      />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
                      <Line type="monotone" dataKey="sentiment" stroke="hsl(140 55% 60%)" strokeWidth={1.5} dot={false} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2">
                  <SentimentIndicator
                    mean={topic.sentiment?.mean}
                    polarisation={topic.sentiment?.polarisation}
                    sampleSize={topic.sentiment?.sample_size}
                  />
                </div>
              </ChartCard>
            </div>

            {/* Related topics — nearest neighbours by centroid distance */}
            <section
              data-testid="related-topics"
              className="mt-4 rounded-sm border hairline bg-background/40 p-4"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Related topics
                </h3>
                <span className="mono text-[10px] text-neutral-500">
                  by centroid distance · 0 identical → 2 opposite
                </span>
              </div>
              {/* Radar legend */}
              <div className="mt-2 flex flex-wrap items-center gap-3 mono text-[10px] uppercase tracking-widest text-neutral-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex gap-[3px]">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="block h-1.5 w-1.5 rounded-[1px]"
                        style={{ background: "hsl(25, 95%, 60%)" }}
                      />
                    ))}
                  </span>
                  <span>5 lit · identical</span>
                </span>
                <span>→</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex gap-[3px]">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="block h-1.5 w-1.5 rounded-[1px]"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      />
                    ))}
                  </span>
                  <span>0 lit · opposite</span>
                </span>
                <span className="text-neutral-600">·</span>
                <span>hover a tile to reveal <span className="text-neutral-300">compare</span> · pin up to 2</span>
              </div>

              {/* Compare panel */}
              {compareIds.length > 0 && (
                <ComparePanel
                  origin={topic}
                  originHistory={history}
                  compareA={compareIds[0] != null ? compareA.data?.data : null}
                  compareB={compareIds[1] != null ? compareB.data?.data : null}
                  loadingA={compareA.isLoading}
                  loadingB={compareB.isLoading}
                  onClearA={() => setCompareIds((c) => c.filter((_, i) => i !== 0))}
                  onClearB={() => setCompareIds((c) => c.filter((_, i) => i !== 1))}
                  onClearAll={() => setCompareIds([])}
                />
              )}

              <div className="mt-3">
                {neighboursQ.isError ? (
                  neighboursQ.error?.code === 404 ? (
                    <div className="text-xs text-muted-foreground">
                      This topic has no comparable centroid yet — new topics need a few hours to
                      settle before neighbours are meaningful.
                    </div>
                  ) : (
                    <ErrorState error={neighboursQ.error} title="Neighbours unavailable" />
                  )
                ) : neighboursQ.isLoading ? (
                  <div className="mono text-xs text-muted-foreground">loading neighbours…</div>
                ) : (neighboursQ.data?.data || []).length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    No comparable topics found — this one sits far from the rest of the map.
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {neighboursQ.data.data.map((n) => {
                      const closeness = Math.max(0, Math.min(1, 1 - (n.distance ?? 1) / 2));
                      const pinned = compareIds.includes(n.topic_id);
                      return (
                        <li key={n.topic_id} className="group relative">
                          {/* Compare pin — always visible (muted), highlights on hover.
                              Bottom-left to avoid the closeness column at top-right. */}
                          <button
                            data-testid={`compare-pin-${n.topic_id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              togglePin(n.topic_id);
                            }}
                            className={`absolute left-2 bottom-2 z-10 inline-flex items-center gap-1 rounded-sm border hairline px-1.5 py-0.5 mono text-[9px] uppercase tracking-widest transition-opacity ${
                              pinned
                                ? "bg-[hsl(25,95%,60%)]/20 text-[hsl(25,95%,70%)] opacity-100 border-[hsl(25,95%,60%)]/40"
                                : "bg-background/70 text-muted-foreground opacity-60 hover:opacity-100 hover:text-neutral-100"
                            }`}
                            title={pinned ? "Unpin from compare" : "Pin to compare"}
                          >
                            {pinned ? <Pin className="h-2.5 w-2.5" /> : <GitCompare className="h-2.5 w-2.5" />}
                            {pinned ? "pinned" : "compare"}
                          </button>
                          <Link
                            to={`/topic/${n.topic_id}`}
                            data-testid={`neighbour-${n.topic_id}`}
                            className={`flex items-start justify-between gap-3 rounded-sm border hairline px-3 py-2 pb-8 no-underline hover:bg-secondary/40 ${
                              pinned ? "ring-1 ring-[hsl(25,95%,60%)]/40" : ""
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm text-neutral-100 group-hover:text-white">
                                {n.name || `Topic #${n.topic_id}`}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2">
                                {n.sector && (
                                  <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                    {n.sector}
                                  </span>
                                )}
                                <HeatBadge
                                  percentile={n.heat_percentile}
                                  confidence={n.heat_confidence}
                                  size="sm"
                                />
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                closeness
                              </div>
                              <div className="mt-0.5 flex items-center justify-end gap-1.5">
                                <ClosenessRadar closeness={closeness} />
                                <span className="mono text-sm text-neutral-100">
                                  {Math.round(closeness * 100)}%
                                </span>
                              </div>
                              <div className="mono text-[10px] text-neutral-500">
                                d={n.distance != null ? n.distance.toFixed(3) : "—"}
                              </div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
            </BlurredSection>
          </>
        )}
      </div>
    </AppShell>
  );
}
