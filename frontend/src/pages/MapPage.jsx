import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, Link2, Lock, Pause, Play, X } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ErrorState, EmptyState } from "../components/ErrorState";
import { NoKeyState } from "../components/NoKeyState";
import { LockedFeature } from "../components/LockedFeature";
import { MapCanvas } from "../components/MapCanvas";
import { HeatBadge } from "../components/HeatBadge";
import { StatusChip } from "../components/StatusChip";
import { useMap, useTopic, useTopics } from "../lib/queries";
import { useTier } from "../lib/tierContext";
import { formatCompact, formatHoursAgo, safeName } from "../lib/format";
import { Sparkline } from "../components/Sparkline";
import { HeatBadge as _HeatBadge } from "../components/HeatBadge";

const WINDOWS = ["24h", "72h", "7d", "30d"];
const FREE_WINDOWS = new Set(["24h"]);
const PERCENTILES = ["10", "25", "50", "all"];

function useDebounced(value, delay) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/**
 * Session-scoped bounds. UMAP is refit on server restart, so remember the
 * first non-empty bounds we see, and invalidate whenever the query errors
 * or we switch back from an empty result (which may indicate a gap).
 */
function useFixedBounds(points, resetToken) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current = null;
  }, [resetToken]);
  return useMemo(() => {
    if (ref.current) return ref.current;
    if (!points || !points.length) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const padX = (maxX - minX) * 0.05 || 1;
    const padY = (maxY - minY) * 0.05 || 1;
    const b = { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
    ref.current = b;
    return b;
  }, [points]);
}

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const { tier } = useTier();

  const win = params.get("window") || "24h";
  const asof = params.get("asof") || "";
  const colorBy = params.get("color") === "velocity" ? "velocity" : "age";
  const showHeat = params.get("heat") !== "0";
  const mode = params.get("mode") === "moment" ? "moment" : "cumulative";
  const percentile = PERCENTILES.includes(params.get("percentile")) ? params.get("percentile") : "25";
  const focusTopicId = params.get("topic_id") ? Number(params.get("topic_id")) : undefined;

  // Scrubber UI (Pro only)
  const [scrubHours, setScrubHours] = useState(() => {
    if (!asof) return 0;
    const diff = (Date.now() - new Date(asof).getTime()) / 3600000;
    return Math.max(0, Math.min(720, Math.round(diff)));
  });
  const debouncedScrub = useDebounced(scrubHours, 250);

  useEffect(() => {
    if (tier !== "pro") return;
    const next = new URLSearchParams(params);
    if (debouncedScrub === 0) next.delete("asof");
    else next.set("asof", new Date(Date.now() - debouncedScrub * 3600000).toISOString());
    setParams(next, { replace: true });
  }, [debouncedScrub, tier, params, setParams]);

  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || tier !== "pro") return;
    const id = setInterval(() => {
      setScrubHours((h) => (h <= 0 ? (setPlaying(false), 0) : h - 1));
    }, 800);
    return () => clearInterval(id);
  }, [playing, tier]);

  const setParam = useCallback(
    (k, v) => {
      const next = new URLSearchParams(params);
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const limit = typeof window !== "undefined" && window.innerWidth < 768 ? 1200 : 2500;
  const mapQuery = useMap({
    window: win,
    asof: asof || undefined,
    limit,
    mode,
    percentile: mode === "moment" ? percentile : undefined,
    topic_id: focusTopicId,
  });
  const topicsQuery = useTopics({ limit: 100 });
  const topicsMap = useMemo(() => {
    const m = new Map();
    (topicsQuery.data?.data || []).forEach((t) => m.set(t.topic_id, t));
    return m;
  }, [topicsQuery.data]);

  const points = mapQuery.data?.data?.points || [];
  const noteMsg = mapQuery.data?.data?.note;
  // Bounds reset when mode/window changes, since Moment mode's sparse sample
  // may not cover the same extent; keep the fixed geography contract.
  const bounds = useFixedBounds(points, focusTopicId ? "focus" : `${mode}:${win}`);
  const disclaimer = mapQuery.data?.meta?.disclaimer;
  const hasKey = Boolean(process.env.REACT_APP_PULSE_KEY_FREE);
  const returnedMode = mapQuery.data?.data?.mode || mapQuery.data?.meta?.mode || mode;

  const [hover, setHover] = useState(null);
  const [openTopic, setOpenTopic] = useState(null);
  const [copied, setCopied] = useState(false);

  const onHoverPoint = useCallback((obj, x, y) => {
    if (!obj) return setHover(null);
    setHover({ point: obj, x, y });
  }, []);

  const onClickPoint = useCallback(
    (obj) => {
      if (!obj) return;
      const t = obj.topic_id != null ? topicsMap.get(obj.topic_id) : null;
      setOpenTopic({ point: obj, topic: t });
    },
    [topicsMap],
  );

  const asOfStamp = mapQuery.data?.meta?.as_of || mapQuery.data?.meta?.generated_at;

  const focusTopic = focusTopicId != null ? topicsMap.get(focusTopicId) : null;
  // Fetch 24h history for the focused topic so the banner can answer
  // "is this one rising?" without leaving the map.
  const focusHistoryQ = useTopic({
    topicId: focusTopicId,
    history_hours: 24,
    members: 0,
  });
  const focusHistory = focusHistoryQ.data?.data?.history || [];

  return (
    <AppShell disclaimer={disclaimer} dense>
      <div data-testid="map-page" className="relative h-[calc(100vh-104px)] w-full">
        {/* Canvas layer */}
        <div className="absolute inset-0">
          {!hasKey ? (
            <div className="p-4"><NoKeyState /></div>
          ) : mapQuery.isError ? (
            <div className="p-4">
              <ErrorState error={mapQuery.error} title="Map unavailable" />
            </div>
          ) : mapQuery.isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="mono text-xs text-muted-foreground">loading semantic map…</div>
              <div className="mono text-[10px] uppercase tracking-widest text-neutral-600 max-w-xs">
                staging is tunnelled — first fetch can take up to 2 minutes.
              </div>
            </div>
          ) : points.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title={mode === "moment" ? "No moment data here" : "No content in this window"}
                note={
                  noteMsg
                    ? noteMsg
                    : mode === "moment"
                    ? "Moment mode has data from 2026-07-15 onward. Try a later timestamp or switch to Cumulative."
                    : "Try widening the window."
                }
              />
            </div>
          ) : (
            <MapCanvas
              points={points}
              topics={topicsMap}
              colorBy={colorBy}
              showHeat={showHeat}
              bounds={bounds}
              onHoverPoint={onHoverPoint}
              onClickPoint={onClickPoint}
            />
          )}
        </div>

        {/* Focus banner — carries the focused topic's 24h velocity sparkline
            so the map answers "is this one rising?" without leaving. */}
        {focusTopicId != null && (
          <div className="pointer-events-auto absolute left-3 top-14 z-10 flex items-center gap-3 rounded-sm border hairline bg-background/90 px-3 py-2 backdrop-blur">
            <Filter className="h-3 w-3 text-neutral-200" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  focus
                </span>
                <span className="text-xs text-neutral-100 truncate max-w-[220px]">
                  {focusTopic ? safeName(focusTopic) : focusHistoryQ.data?.data?.name || `Topic #${focusTopicId}`}
                </span>
              </div>
              {focusHistoryQ.isLoading ? (
                <div className="mono text-[10px] text-neutral-500 mt-0.5">loading 24h arc…</div>
              ) : focusHistory.length >= 2 ? (
                <div className="mt-1 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      24h velocity
                    </span>
                    <Sparkline
                      data={focusHistory}
                      field="velocity"
                      width={110}
                      height={22}
                      stroke="hsl(25, 95%, 60%)"
                      showZero
                    />
                  </div>
                  {(() => {
                    const latest = [...focusHistory].reverse().find((h) => h.heat_percentile != null);
                    if (!latest) return null;
                    return (
                      <_HeatBadge
                        percentile={latest.heat_percentile}
                        confidence={latest.heat_confidence}
                        size="sm"
                      />
                    );
                  })()}
                </div>
              ) : (
                <div className="mono text-[10px] text-neutral-500 mt-0.5">
                  not enough history for a sparkline
                </div>
              )}
            </div>
            <button
              data-testid="clear-focus"
              onClick={() => setParam("topic_id", "")}
              className="ml-1 rounded-sm p-0.5 text-muted-foreground hover:text-neutral-100"
              title="Show every point again"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Top controls */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start gap-2 p-3">
          <div className="pointer-events-auto flex items-center gap-1 rounded-sm border hairline bg-background/85 p-1 backdrop-blur">
            {WINDOWS.map((w) => {
              const locked = tier === "free" && !FREE_WINDOWS.has(w);
              return (
                <button
                  key={w}
                  data-testid={`window-${w}`}
                  onClick={() => !locked && setParam("window", w)}
                  disabled={locked}
                  className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 mono text-[11px] uppercase tracking-widest transition-colors ${
                    win === w
                      ? "bg-secondary text-neutral-50"
                      : locked
                      ? "text-muted-foreground/50 cursor-not-allowed"
                      : "text-muted-foreground hover:text-neutral-100"
                  }`}
                  title={locked ? "Extended windows are Pro" : `Show the last ${w}`}
                >
                  {w}
                  {locked && <Lock className="h-2.5 w-2.5" />}
                </button>
              );
            })}
          </div>

          {/* Mode toggle */}
          <div className="pointer-events-auto inline-flex items-center gap-1 rounded-sm border hairline bg-background/85 p-1 backdrop-blur">
            <button
              data-testid="mode-cumulative"
              onClick={() => setParam("mode", "")}
              className={`rounded-sm px-2 py-1 mono text-[11px] uppercase tracking-widest transition-colors ${
                mode === "cumulative"
                  ? "bg-secondary text-neutral-50"
                  : "text-muted-foreground hover:text-neutral-100"
              }`}
              title="Everything published in the window"
            >
              cumulative
            </button>
            <button
              data-testid="mode-moment"
              onClick={() => setParam("mode", "moment")}
              className={`rounded-sm px-2 py-1 mono text-[11px] uppercase tracking-widest transition-colors ${
                mode === "moment"
                  ? "bg-secondary text-neutral-50"
                  : "text-muted-foreground hover:text-neutral-100"
              }`}
              title="Only what was actively moving at asof — sparser, sharper"
            >
              moment
            </button>
          </div>

          {/* Percentile selector — only in moment mode */}
          {mode === "moment" && (
            <div className="pointer-events-auto inline-flex items-center gap-1 rounded-sm border hairline bg-background/85 p-1 backdrop-blur">
              <span className="px-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">
                top
              </span>
              {PERCENTILES.map((p) => (
                <button
                  key={p}
                  data-testid={`percentile-${p}`}
                  onClick={() => setParam("percentile", p === "25" ? "" : p)}
                  className={`rounded-sm px-2 py-1 mono text-[11px] uppercase tracking-widest transition-colors ${
                    percentile === p
                      ? "bg-secondary text-neutral-50"
                      : "text-muted-foreground hover:text-neutral-100"
                  }`}
                  title={p === "all" ? "Everything alive at asof" : `Top ${p}% by velocity that hour`}
                >
                  {p === "all" ? "all" : `${p}%`}
                </button>
              ))}
            </div>
          )}

          <div className="pointer-events-auto inline-flex items-center gap-1 rounded-sm border hairline bg-background/85 p-1 backdrop-blur">
            <button
              data-testid="color-age"
              onClick={() => setParam("color", "")}
              className={`rounded-sm px-2 py-1 mono text-[11px] uppercase tracking-widest transition-colors ${
                colorBy === "age" ? "bg-secondary text-neutral-50" : "text-muted-foreground hover:text-neutral-100"
              }`}
            >
              age
            </button>
            <button
              data-testid="color-velocity"
              onClick={() => setParam("color", "velocity")}
              className={`rounded-sm px-2 py-1 mono text-[11px] uppercase tracking-widest transition-colors ${
                colorBy === "velocity" ? "bg-secondary text-neutral-50" : "text-muted-foreground hover:text-neutral-100"
              }`}
            >
              velocity
            </button>
          </div>

          <button
            data-testid="heat-toggle"
            onClick={() => setParam("heat", showHeat ? "0" : "1")}
            className={`pointer-events-auto rounded-sm border hairline px-2.5 py-1.5 mono text-[11px] uppercase tracking-widest transition-colors ${
              showHeat ? "bg-secondary text-neutral-50" : "bg-background/85 text-muted-foreground hover:text-neutral-100"
            }`}
          >
            heat field {showHeat ? "on" : "off"}
          </button>

          <button
            data-testid="copy-share-link"
            onClick={async () => {
              const url = typeof window !== "undefined" ? window.location.href : "";
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              } catch {
                if (typeof window !== "undefined") window.prompt("Copy this link:", url);
              }
            }}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-sm border hairline bg-background/85 px-2.5 py-1.5 mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-neutral-100"
            title="Copy a link to this exact map view"
          >
            <Link2 className="h-3 w-3" />
            {copied ? "copied" : "share link"}
          </button>

          <div className="pointer-events-auto ml-auto rounded-sm border hairline bg-background/85 px-2.5 py-1.5 backdrop-blur mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="text-neutral-200">{points.length.toLocaleString()}</span> shown
            {mapQuery.data?.data?.reference_size ? (
              <span className="ml-2 text-neutral-500">
                / {mapQuery.data.data.reference_size.toLocaleString()} in scope
              </span>
            ) : null}
            {mapQuery.data?.data?.duplicates_collapsed > 0 && (
              <span className="ml-2 text-neutral-500">
                · {mapQuery.data.data.duplicates_collapsed} re-uploads hidden
              </span>
            )}
            {returnedMode === "moment" && (
              <span className="ml-2 heat-2">moment</span>
            )}
          </div>
        </div>

        {/* Scrubber */}
        <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 rounded-sm border hairline bg-background/90 p-3 backdrop-blur">
          {tier === "pro" ? (
            <>
              <div className="mb-2 flex items-center justify-between mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <div className="flex items-center gap-2">
                  <button
                    data-testid="scrub-back"
                    onClick={() => setScrubHours((h) => Math.min(720, h + 1))}
                    className="rounded-sm border hairline p-1 hover:bg-secondary"
                    title="Step back 1 hour"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <button
                    data-testid="scrub-play"
                    onClick={() => setPlaying((p) => !p)}
                    className={`rounded-sm border hairline p-1 hover:bg-secondary ${playing ? "pulse-glow" : ""}`}
                    title={playing ? "Pause" : "Play forward through time"}
                  >
                    {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </button>
                  <button
                    data-testid="scrub-fwd"
                    onClick={() => setScrubHours((h) => Math.max(0, h - 1))}
                    className="rounded-sm border hairline p-1 hover:bg-secondary"
                    title="Step forward 1 hour"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-3 text-neutral-200">
                  <span>{scrubHours === 0 ? "now" : `${formatHoursAgo(scrubHours)} ago`}</span>
                  <span className="text-neutral-500">·</span>
                  <span className="mono text-[10px] text-muted-foreground">
                    {asOfStamp ? new Date(asOfStamp).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—"}
                  </span>
                </div>
              </div>
              <input
                data-testid="scrubber"
                type="range"
                className="scrubber w-full"
                min={0}
                max={720}
                value={scrubHours}
                onChange={(e) => setScrubHours(Number(e.target.value))}
                aria-label="Time scrubber"
              />
              <div className="mt-1 flex justify-between mono text-[9px] uppercase tracking-widest text-neutral-600">
                <span>30d ago</span>
                <span>now</span>
              </div>
            </>
          ) : (
            <LockedFeature feature="time travel" />
          )}
        </div>

        {/* Hover card */}
        {hover && (
          <div
            data-testid="map-hover"
            className="pointer-events-none absolute z-20 max-w-xs rounded-sm border hairline bg-background/95 p-2.5 shadow-lg backdrop-blur"
            style={{
              left: Math.min(hover.x + 12, (typeof window !== "undefined" ? window.innerWidth : 1000) - 320),
              top: Math.min(hover.y + 12, (typeof window !== "undefined" ? window.innerHeight : 800) - 160),
            }}
          >
            <div className="text-xs font-medium text-neutral-100 line-clamp-2">
              {hover.point.title}
            </div>
            <div className="mt-1 mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {hover.point.channel} · {hover.point.platform}
            </div>
            <div className="mt-1 flex items-center gap-3 mono text-[10px] text-neutral-300">
              <span>{formatCompact(hover.point.views)} views</span>
              <span className="text-neutral-600">·</span>
              <span>{formatHoursAgo(hover.point.age_hours)} old</span>
            </div>
          </div>
        )}

        {/* Side panel */}
        {openTopic && (
          <aside
            data-testid="map-side-panel"
            className="absolute right-0 top-0 z-30 flex h-full w-full max-w-md flex-col border-l hairline bg-background/95 backdrop-blur"
          >
            <div className="flex items-start justify-between border-b hairline p-4">
              <div className="min-w-0">
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Content on the map
                </div>
                <div className="mt-1 text-sm text-neutral-100 line-clamp-3">
                  {openTopic.point.title}
                </div>
                <div className="mt-1 mono text-[10px] text-muted-foreground">
                  {openTopic.point.channel} · {formatHoursAgo(openTopic.point.age_hours)} · {formatCompact(openTopic.point.views)} views
                </div>
              </div>
              <button
                data-testid="side-panel-close"
                onClick={() => setOpenTopic(null)}
                className="mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-neutral-100"
              >
                close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {openTopic.topic ? (
                <>
                  <div className="flex items-center gap-2">
                    <StatusChip status={openTopic.topic.status} />
                    {openTopic.topic.sector && (
                      <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {openTopic.topic.sector}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight text-neutral-50">
                    {safeName(openTopic.topic)}
                  </h2>
                  <div className="mt-2">
                    <HeatBadge
                      percentile={openTopic.topic.heat_percentile}
                      confidence={openTopic.topic.heat_confidence}
                      size="lg"
                    />
                  </div>
                  {openTopic.topic.summary && (
                    <p className="mt-3 text-sm leading-relaxed text-neutral-300">
                      {openTopic.topic.summary}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      to={`/topic/${openTopic.topic.topic_id}`}
                      data-testid="open-topic-detail"
                      className="inline-flex items-center gap-1 rounded-sm border hairline bg-secondary/60 px-3 py-1.5 text-xs text-neutral-100 hover:bg-secondary"
                    >
                      Open topic detail →
                    </Link>
                    <button
                      data-testid="focus-on-topic"
                      onClick={() => {
                        setParam("topic_id", String(openTopic.topic.topic_id));
                        setOpenTopic(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-sm border hairline bg-background px-3 py-1.5 text-xs text-neutral-200 hover:bg-secondary"
                      title="Show only this topic's points on the map"
                    >
                      <Filter className="h-3 w-3" />
                      Focus on map
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  This point isn&apos;t clustered into a topic yet. Unclustered content
                  {" "}&ldquo;noise&rdquo; is normal and usually the majority.
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </AppShell>
  );
}
