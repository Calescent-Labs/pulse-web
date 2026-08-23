import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, ChevronLeft, ChevronRight, Download, Filter, Layers, Link2, Lock, Pause, Play, Sparkles, X } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ErrorState, EmptyState } from "../components/ErrorState";
import { NoKeyState } from "../components/NoKeyState";
import { LockedFeature } from "../components/LockedFeature";
import { MapCanvas } from "../components/MapCanvas";
import { SignalsPanel } from "../components/SignalsPanel";
import { RegionPanel } from "../components/RegionPanel";
import { HeatBadge } from "../components/HeatBadge";
import { useMap, useMapRegion, useTopic, useTopics } from "../lib/queries";
import { useTier } from "../lib/tierContext";
import { useSignUpModal } from "../components/SignUpModal";
import { formatHoursAgo, safeName } from "../lib/format";
import { Sparkline } from "../components/Sparkline";
import { downloadTopicOg } from "../lib/ogCanvas";

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
 * first non-empty bounds we see, and invalidate whenever window/mode changes.
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
  const { open: openSignUp } = useSignUpModal();

  const win = params.get("window") || "24h";
  const asof = params.get("asof") || "";
  const showHeat = params.get("heat") !== "0";
  const mode = params.get("mode") === "moment" ? "moment" : "cumulative";
  const percentile = PERCENTILES.includes(params.get("percentile")) ? params.get("percentile") : "25";
  const focusTopicId = params.get("topic_id") ? Number(params.get("topic_id")) : undefined;
  const view = params.get("view") === "3d" ? "3d" : "2d";
  const is3D = view === "3d";

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
    limit: is3D ? undefined : limit,
    mode,
    percentile: mode === "moment" ? percentile : undefined,
    topic_id: focusTopicId,
    aggregated: is3D ? "hex" : undefined,
    resolution: is3D ? 40 : undefined,
    // 3D view drops points entirely — cells drive the render, so keep the
    // payload under mobile budgets.
    points: is3D ? false : undefined,
  });
  // Topics feed used only for weighting the heat by velocity — no rendering.
  const topicsQuery = useTopics({ limit: 100 });
  const topicsMap = useMemo(() => {
    const m = new Map();
    (topicsQuery.data?.data || []).forEach((t) => m.set(t.topic_id, t));
    return m;
  }, [topicsQuery.data]);

  const points = mapQuery.data?.data?.points || [];
  const cells = mapQuery.data?.data?.cells || [];
  const cellSize = mapQuery.data?.data?.cell_size;
  const noteMsg = mapQuery.data?.data?.note;
  // 3D uses server-returned bounds directly (points are omitted); 2D falls
  // back to session-scoped bounds computed from the point cloud.
  const responseBounds = mapQuery.data?.data?.bounds || mapQuery.data?.meta?.bounds || null;
  const pointBounds = useFixedBounds(points, focusTopicId ? "focus" : `${mode}:${win}:${view}`);
  const bounds = is3D ? responseBounds : pointBounds;
  const disclaimer = mapQuery.data?.meta?.disclaimer;
  const hasKey = Boolean(process.env.REACT_APP_PULSE_KEY_FREE);
  const returnedMode = mapQuery.data?.data?.mode || mapQuery.data?.meta?.mode || mode;
  const asOfStamp = mapQuery.data?.meta?.as_of || mapQuery.data?.meta?.generated_at;

  const focusTopic = focusTopicId != null ? topicsMap.get(focusTopicId) : null;
  const focusHistoryQ = useTopic({
    topicId: focusTopicId,
    history_hours: 24,
    members: 0,
  });
  const focusHistory = focusHistoryQ.data?.data?.history || [];

  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Viewport-driven signals panel
  const [visibleBounds, setVisibleBounds] = useState(null);
  const [signalsOpen, setSignalsOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 900 : true,
  );
  const [signalsSort, setSignalsSort] = useState("count");
  const [hoveredTopicId, setHoveredTopicId] = useState(null);
  const [hoveredRank, setHoveredRank] = useState(null);
  const [hoveredLocked, setHoveredLocked] = useState(false);
  const boundsTimer = useRef(null);
  const onBoundsChange = useCallback((b) => {
    if (boundsTimer.current) clearTimeout(boundsTimer.current);
    boundsTimer.current = setTimeout(() => setVisibleBounds(b), 180);
  }, []);
  const onHoverTopic = useCallback((info) => {
    if (info == null) {
      setHoveredTopicId(null);
      setHoveredRank(null);
      setHoveredLocked(false);
      return;
    }
    setHoveredTopicId(info.topicId);
    setHoveredRank(info.rank);
    setHoveredLocked(Boolean(info.locked));
  }, []);

  // Screen-space centroid of the highlighted topic's points (for the ghost chip).
  // MapCanvas computes it via viewport.project and calls back.
  const [highlightScreen, setHighlightScreen] = useState(null);
  useEffect(() => {
    if (hoveredTopicId == null) setHighlightScreen(null);
  }, [hoveredTopicId]);

  // Region investigation — user clicks the map/hex → we fetch /v1/map/region
  // and slide a right-side panel in. Cleared on close, on view flip, and on
  // window/mode change (the same "session" concerns as bounds).
  const [regionCentre, setRegionCentre] = useState(null);
  useEffect(() => {
    setRegionCentre(null);
  }, [view, mode, win, focusTopicId]);
  const onRegionClick = useCallback((c) => {
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return;
    setRegionCentre({ x: c.x, y: c.y, radius: c.radius || 1.0 });
  }, []);
  const regionQuery = useMapRegion({
    x: regionCentre?.x,
    y: regionCentre?.y,
    radius: regionCentre?.radius,
    window: win,
    limit: 5,
    enabled: Boolean(regionCentre),
  });

  // Compute topics visible inside the current viewport by aggregating points.
  // Falls back to the full topic feed sorted by heat until we have a bounds
  // reading (first render before onAfterRender fires) or when heat is off.
  const visibleAggregate = useMemo(() => {
    const inView = (p) =>
      !visibleBounds ||
      (p.x >= visibleBounds.minX &&
        p.x <= visibleBounds.maxX &&
        p.y >= visibleBounds.minY &&
        p.y <= visibleBounds.maxY);

    const counts = new Map();
    let noise = 0;
    for (const p of points) {
      if (!inView(p)) continue;
      if (p.topic_id == null) {
        noise += 1;
        continue;
      }
      counts.set(p.topic_id, (counts.get(p.topic_id) || 0) + 1);
    }

    const rows = [];
    counts.forEach((count, topicId) => {
      const t = topicsMap.get(topicId);
      if (!t) return; // unnamed / not in top-100 feed
      rows.push({ topic: t, countInView: count });
    });

    // If we haven't heard from the viewport yet, seed with the full topic feed
    // ranked by heat so the panel has content immediately.
    if (!visibleBounds && rows.length === 0) {
      topicsMap.forEach((t) => rows.push({ topic: t, countInView: 0 }));
    }

    rows.sort((a, b) => {
      if (signalsSort === "heat") {
        return (b.topic.heat_percentile || 0) - (a.topic.heat_percentile || 0);
      }
      return b.countInView - a.countInView || (b.topic.heat_percentile || 0) - (a.topic.heat_percentile || 0);
    });

    return { rows: rows.slice(0, 30), noise };
  }, [points, topicsMap, visibleBounds, signalsSort]);

  return (
    <AppShell disclaimer={disclaimer} dense>
      <div data-testid="map-page" className="relative h-[calc(100vh-104px)] w-full">
        {/* Canvas — heat only, no individual signal dots */}
        <div className="absolute inset-0">
          {!hasKey ? (
            <div className="p-4"><NoKeyState /></div>
          ) : mapQuery.isError ? (
            <div className="p-4">
              <ErrorState error={mapQuery.error} title="Map unavailable" />
            </div>
          ) : mapQuery.isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="mono text-xs text-muted-foreground">loading semantic heat…</div>
              <div className="mono text-[10px] uppercase tracking-widest text-neutral-600 max-w-xs">
                staging is tunnelled — first fetch can take up to 2 minutes.
              </div>
            </div>
          ) : (points.length === 0 && cells.length === 0) ? (
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
              view={view}
              points={points}
              cells={cells}
              cellSize={cellSize}
              topics={topicsMap}
              showHeat={showHeat}
              bounds={bounds}
              onBoundsChange={onBoundsChange}
              hoveredTopicId={hoveredTopicId}
              onHighlightScreen={setHighlightScreen}
              onRegionClick={onRegionClick}
            />
          )}
        </div>

        {/* Ghost rank chip — floats near the highlighted cluster's screen
            centroid so a Free user hovering a blurred row sees "cluster #N"
            without reading the topic name. */}
        {hoveredRank != null && highlightScreen && (
          <div
            data-testid="ghost-rank-chip"
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-sm border hairline bg-background/95 px-2 py-1 mono text-[10px] uppercase tracking-[0.18em] text-[hsl(48,95%,68%)] shadow-lg backdrop-blur"
            style={{
              left: `${highlightScreen.x}px`,
              top: `${Math.max(24, highlightScreen.y - 20)}px`,
            }}
          >
            <span className="text-neutral-300">cluster</span>{" "}
            <span className="text-neutral-50">#{hoveredRank}</span>
            {hoveredLocked && (
              <span className="ml-1.5 text-neutral-500">· pro</span>
            )}
          </div>
        )}

        {/* Signals panel — right-side list of topics inside the current view.
            Hidden while the region investigation panel is open (they share
            the same right-column slot). */}
        {hasKey && !mapQuery.isError && !regionCentre && (
          <SignalsPanel
            visibleTopics={visibleAggregate.rows}
            visibleNoiseCount={visibleAggregate.noise}
            sort={signalsSort}
            onSortChange={setSignalsSort}
            open={signalsOpen}
            onToggle={() => setSignalsOpen((o) => !o)}
            loading={mapQuery.isLoading || topicsQuery.isLoading}
            tier={tier}
            onHoverTopic={onHoverTopic}
            focusedTopicId={focusTopicId}
          />
        )}

        {/* Region investigation panel — opens on click, in 2D or 3D. */}
        {hasKey && regionCentre && (
          <RegionPanel
            center={regionCentre}
            query={regionQuery}
            onClose={() => setRegionCentre(null)}
          />
        )}

        {/* Focus banner — 24h velocity sparkline of the focused topic */}
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
                      <HeatBadge
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
              title="Show every region again"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Top controls */}
        <div
          className={`pointer-events-none absolute top-0 z-10 flex flex-wrap items-start gap-2 p-3 transition-[right] duration-200 ${
            hasKey && !mapQuery.isError && (signalsOpen || regionCentre)
              ? "left-0 right-[340px]"
              : "inset-x-0"
          }`}
        >
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
              title="Every signal alive in the window"
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

          <button
            data-testid="heat-toggle"
            onClick={() => setParam("heat", showHeat ? "0" : "1")}
            disabled={is3D}
            className={`pointer-events-auto rounded-sm border hairline px-2.5 py-1.5 mono text-[11px] uppercase tracking-widest transition-colors ${
              showHeat && !is3D ? "bg-secondary text-neutral-50" : "bg-background/85 text-muted-foreground hover:text-neutral-100"
            } ${is3D ? "cursor-not-allowed opacity-40" : ""}`}
            title={is3D ? "Heat field is 2D only — hex columns carry the signal in 3D" : "Toggle the heat field"}
          >
            heat field {showHeat && !is3D ? "on" : "off"}
          </button>

          {/* 2D / 3D view toggle */}
          <div className="pointer-events-auto inline-flex items-center gap-1 rounded-sm border hairline bg-background/85 p-1 backdrop-blur">
            <button
              data-testid="view-2d"
              onClick={() => setParam("view", "")}
              className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 mono text-[11px] uppercase tracking-widest transition-colors ${
                view === "2d"
                  ? "bg-secondary text-neutral-50"
                  : "text-muted-foreground hover:text-neutral-100"
              }`}
              title="Flat semantic heat field"
            >
              <Layers className="h-3 w-3" />
              2D
            </button>
            <button
              data-testid="view-3d"
              onClick={() => setParam("view", "3d")}
              className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 mono text-[11px] uppercase tracking-widest transition-colors ${
                view === "3d"
                  ? "bg-secondary text-neutral-50"
                  : "text-muted-foreground hover:text-neutral-100"
              }`}
              title="Extruded hex columns · height = mean velocity · drag to rotate"
            >
              <Box className="h-3 w-3" />
              3D
            </button>
          </div>

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
            title={
              focusTopicId != null
                ? "Copy a link to this map view — carries the focused topic. Dynamic OG previews will render the topic's arc when that ships."
                : "Copy a link to this exact map view"
            }
          >
            <Link2 className="h-3 w-3" />
            {copied ? "copied" : focusTopicId != null ? "share arc link" : "share link"}
          </button>

          {focusTopicId != null && (
            <button
              data-testid="download-arc-png"
              onClick={async () => {
                const t =
                  focusTopic ||
                  (focusHistoryQ.data?.data ? focusHistoryQ.data.data : { topic_id: focusTopicId });
                try {
                  setDownloading(true);
                  await downloadTopicOg(t, focusHistory);
                } catch {
                  /* silent */
                } finally {
                  setDownloading(false);
                }
              }}
              disabled={focusHistoryQ.isLoading || focusHistory.length < 2}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-sm border hairline bg-background/85 px-2.5 py-1.5 mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              title="Download a 1200×630 preview PNG of this topic's 24h arc"
            >
              <Download className="h-3 w-3" />
              {downloading ? "rendering…" : "preview png"}
            </button>
          )}

          <div className="pointer-events-auto ml-auto flex items-center gap-2">
            <button
              data-testid="get-notified"
              onClick={() => openSignUp("Pro launch")}
              className="inline-flex items-center gap-1.5 rounded-sm border hairline bg-[hsl(25,95%,60%)]/10 px-2.5 py-1.5 mono text-[10px] uppercase tracking-widest text-[hsl(25,95%,72%)] transition-colors hover:bg-[hsl(25,95%,60%)]/20"
              title="Get notified when Pulse Pro opens (time travel, extended windows, filters)"
            >
              <Sparkles className="h-3 w-3" />
              get notified
            </button>
            <div className="rounded-sm border hairline bg-background/85 px-2.5 py-1.5 backdrop-blur mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {is3D ? (
                <>
                  <span className="text-neutral-200">{cells.length.toLocaleString()}</span> hex cells
                </>
              ) : (
                <>
                  <span className="text-neutral-200">{points.length.toLocaleString()}</span> signals
                  {mapQuery.data?.data?.reference_size ? (
                    <span className="ml-2 text-neutral-500">
                      / {mapQuery.data.data.reference_size.toLocaleString()} in scope
                    </span>
                  ) : null}
                </>
              )}
              {returnedMode === "moment" && (
                <span className="ml-2 heat-2">moment</span>
              )}
            </div>
          </div>
        </div>

        {/* Scrubber */}
        <div
          className={`pointer-events-auto absolute bottom-3 z-10 rounded-sm border hairline bg-background/90 p-3 backdrop-blur transition-[right] duration-200 ${
            hasKey && !mapQuery.isError && (signalsOpen || regionCentre)
              ? "left-3 right-[340px]"
              : "inset-x-3"
          }`}
        >
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
      </div>
    </AppShell>
  );
}
