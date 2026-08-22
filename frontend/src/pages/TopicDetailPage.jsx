import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Lock, AlertTriangle } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { AppShell } from "../components/AppShell";
import { HeatBadge } from "../components/HeatBadge";
import { SentimentIndicator } from "../components/SentimentIndicator";
import { StatusChip } from "../components/StatusChip";
import { LockedFeature } from "../components/LockedFeature";
import { ErrorState } from "../components/ErrorState";
import { NoKeyState } from "../components/NoKeyState";
import { useTopic } from "../lib/queries";
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

  const [historyHours, setHistoryHours] = useState(24);
  const q = useTopic({ topicId, history_hours: historyHours, members: 50 });

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
                <p className="mt-3 max-w-3xl text-sm sm:text-base leading-relaxed text-neutral-300">
                  {topic.summary}
                </p>
              )}
              {topic.entities && topic.entities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {topic.entities.map((e) => (
                    <span
                      key={e}
                      className="rounded-sm border hairline bg-secondary/40 px-2 py-0.5 mono text-[10px] uppercase tracking-widest text-neutral-200"
                    >
                      {e}
                    </span>
                  ))}
                </div>
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
                <MetricCell label="Acceleration" value={formatSigned(topic.signals?.acceleration, 4)} />
                <MetricCell label="Breadth" value={topic.signals?.breadth ?? "—"} sub="channels" />
                <MetricCell label="Freshness" value={formatConfidence(topic.signals?.freshness)} />
              </div>
            </header>

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

              <ChartCard title="Member content" note={`${members.length} items — removed items stay listed`}>
                <ul data-testid="topic-members" className="max-h-56 space-y-2 overflow-auto">
                  {members.length === 0 && (
                    <li className="mono text-xs text-muted-foreground">no member content in range</li>
                  )}
                  {members.map((m) => (
                    <li
                      key={m.url}
                      data-testid={`member-${m.status}`}
                      className={`group flex items-start gap-2 rounded-sm border hairline px-2 py-2 ${
                        m.status === "removed" || m.status === "privated" ? "opacity-60" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`block truncate text-xs no-underline ${
                            m.status === "removed" || m.status === "privated"
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
                      <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </li>
                  ))}
                </ul>
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
