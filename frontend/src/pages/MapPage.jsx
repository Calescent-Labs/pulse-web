import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Link2, Lock, Pause, Play } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { ErrorState, EmptyState } from "../components/ErrorState";
import { NoKeyState } from "../components/NoKeyState";
import { LockedFeature } from "../components/LockedFeature";
import { MapCanvas } from "../components/MapCanvas";
import { HeatBadge } from "../components/HeatBadge";
import { StatusChip } from "../components/StatusChip";
import { useMap, useTopics } from "../lib/queries";
import { useTier } from "../lib/tierContext";
import { formatCompact, formatHoursAgo, formatRelativeFromISO, safeName } from "../lib/format";

const WINDOWS = ["24h", "72h", "7d", "30d"];
const FREE_WINDOWS = new Set(["24h"]);

function useDebounced(value, delay) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function useFixedBounds(points) {
  // Bounds must be stable across window/asof changes. We remember the first
  // non-empty bounds we see this session — UMAP is fitted once per server
  // process, so this is a true fixed frame.
  const ref = useRef(null);
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
  const asof = params.get("asof") || ""; // ISO string
  const colorBy = params.get("color") === "velocity" ? "velocity" : "age";
  const showHeat = params.get("heat") !== "0";

  // Scrubber UI holds a hoursBack value; commits into asof (debounced).
  const [scrubHours, setScrubHours] = useState(() => {
    if (!asof) return 0;
    const diff = (Date.now() - new Date(asof).getTime()) / 3600000;
    return Math.max(0, Math.min(720, Math.round(diff)));
  });
  const debouncedScrub = useDebounced(scrubHours, 250);

  useEffect(() => {
    if (tier !== "pro") return; // free tier can't set asof
    const next = new URLSearchParams(params);
    if (debouncedScrub === 0) next.delete("asof");
    else next.set("asof", new Date(Date.now() - debouncedScrub * 3600000).toISOString());
    setParams(next, { replace: true });
  }, [debouncedScrub, tier, params, setParams]);

  // Playback (Pro-only, sweeps asof back to front)
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
  const mapQuery = useMap({ window: win, asof: asof || undefined, limit });
  // Topics feed for colour-by-velocity + click-to-detail
  const topicsQuery = useTopics({ limit: 100 });
  const topicsMap = useMemo(() => {
    const m = new Map();
    (topicsQuery.data?.data || []).forEach((t) => m.set(t.topic_id, t));
    return m;
  }, [topicsQuery.data]);

  const points = mapQuery.data?.data?.points || [];
  const bounds = useFixedBounds(points);
  const disclaimer = mapQuery.data?.meta?.disclaimer;
  const hasKey = Boolean(process.env.REACT_APP_PULSE_KEY_FREE);

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

  return (
    <AppShell disclaimer={disclaimer} dense>
      <div data-testid="map-page" className="relative h-[calc(100vh-104px)] w-full">
        {/* Map canvas layer */}
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
            <div className="p-4">
              <EmptyState
                title="No content in this window"
                note={mapQuery.data?.data?.note || "Try widening the window."}
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

        {/* Overlay: controls (top) */}
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

          <div className="pointer-events-auto inline-flex items-center gap-1 rounded-sm border hairline bg-background/85 p-1 backdrop-blur">
            <button
              data-testid="color-age"
              onClick={() => setParam("color", "age")}
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
                // clipboard blocked — fall back to prompt
                if (typeof window !== "undefined") window.prompt("Copy this link:", url);
              }
            }}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-sm border hairline bg-background/85 px-2.5 py-1.5 mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-neutral-100"
            title="Copy a link to this exact map view — window, timestamp, and colour mode"
          >
            <Link2 className="h-3 w-3" />
            {copied ? "copied" : "share link"}
          </button>

          <div className="pointer-events-auto ml-auto rounded-sm border hairline bg-background/85 px-2.5 py-1.5 backdrop-blur mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {(mapQuery.data?.data?.reference_size ?? points.length).toLocaleString()} pts
            {mapQuery.data?.data?.duplicates_collapsed > 0 && (
              <span className="ml-2 text-neutral-500">
                · {mapQuery.data.data.duplicates_collapsed} re-uploads hidden
              </span>
            )}
          </div>
        </div>

        {/* Scrubber (bottom) */}
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

        {/* Side panel for clicked point */}
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
                  <div className="mt-4">
                    <Link
                      to={`/topic/${openTopic.topic.topic_id}`}
                      data-testid="open-topic-detail"
                      className="inline-flex items-center gap-1 rounded-sm border hairline bg-secondary/60 px-3 py-1.5 text-xs text-neutral-100 hover:bg-secondary"
                    >
                      Open topic detail →
                    </Link>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  This point isn&apos;t clustered into a topic yet. Unclustered content
                  {" "}&ldquo;noise&rdquo; is normal and usually the majority.
                </div>
              )}
              <div className="mt-6">
                <a
                  href={openTopic.point.title ? undefined : undefined}
                  className="text-xs text-muted-foreground"
                >
                  Content links are available from the topic detail page.
                </a>
              </div>
            </div>
          </aside>
        )}
      </div>
    </AppShell>
  );
}
