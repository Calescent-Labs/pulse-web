import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Radio, Sparkles } from "lucide-react";
import DeckGL from "@deck.gl/react";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { OrthographicView } from "@deck.gl/core";
import { AppShell } from "../components/AppShell";
import { HeatBadge } from "../components/HeatBadge";
import { StatusChip } from "../components/StatusChip";
import { NoKeyState } from "../components/NoKeyState";
import { useHealth, useMap, useTopics } from "../lib/queries";
import { HEATMAP_COLOR_RANGE } from "../lib/heat";
import { formatRelativeFromISO, safeName } from "../lib/format";

const OVIEW = new OrthographicView({ id: "landing-ortho", controller: false });

/**
 * Ambient hero heat — a single real snapshot rendered pure, no chrome, no
 * controls, no dots. Placeholder for the future 7-day timelapse (see
 * /app/API_REQUESTS_v2.md request 1). When the timelapse endpoint lands,
 * this component becomes an animated loop over frames without touching the
 * landing layout.
 */
function AmbientHeat() {
  const q = useMap({ window: "7d", limit: 3000, mode: "cumulative" });
  const points = q.data?.data?.points || [];

  const bounds = useMemo(() => {
    if (!points.length) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const padX = (maxX - minX) * 0.06 || 1;
    const padY = (maxY - minY) * 0.06 || 1;
    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  }, [points]);

  const heatData = useMemo(
    () => points.map((p) => ({ position: [p.x, p.y], weight: 1 })),
    [points],
  );

  const initialViewState = useMemo(() => {
    if (!bounds) return { target: [0, 0, 0], zoom: 5 };
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return { target: [cx, cy, 0], zoom: 5.4 };
  }, [bounds]);

  const layers = useMemo(() => {
    if (!heatData.length) return [];
    return [
      new HeatmapLayer({
        id: "hero-atmosphere",
        data: heatData,
        getPosition: (d) => d.position,
        getWeight: (d) => d.weight,
        radiusPixels: 180,
        intensity: 1.0,
        threshold: 0.02,
        colorRange: HEATMAP_COLOR_RANGE,
        aggregation: "SUM",
        opacity: 0.45,
        pickable: false,
      }),
      new HeatmapLayer({
        id: "hero-focus",
        data: heatData,
        getPosition: (d) => d.position,
        getWeight: (d) => d.weight,
        radiusPixels: 90,
        intensity: 1.6,
        threshold: 0.06,
        colorRange: HEATMAP_COLOR_RANGE,
        aggregation: "SUM",
        opacity: 0.9,
        pickable: false,
      }),
    ];
  }, [heatData]);

  return (
    <div
      data-testid="ambient-heat"
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      style={{ background: "#0a0d13" }}
    >
      {/* Procedural fallback bloom — visible immediately, hidden once real
          data paints. Keeps landing paint <1s even on cold tunnels. */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          heatData.length ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="absolute -left-40 top-20 h-[520px] w-[520px] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, hsl(268,65%,50%,0.55) 0%, transparent 70%)" }} />
        <div className="absolute right-10 top-40 h-[420px] w-[420px] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, hsl(25,95%,55%,0.5) 0%, transparent 70%)" }} />
        <div className="absolute left-1/3 bottom-8 h-[380px] w-[380px] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, hsl(340,78%,55%,0.45) 0%, transparent 70%)" }} />
      </div>

      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          heatData.length ? "opacity-100" : "opacity-0"
        }`}
      >
        <DeckGL
          views={OVIEW}
          initialViewState={initialViewState}
          controller={false}
          layers={layers}
          style={{ position: "absolute", inset: 0 }}
        />
      </div>

      {/* Vignette so foreground copy stays legible */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(14,17,23,0.85) 0%, rgba(14,17,23,0.55) 40%, rgba(14,17,23,0.15) 70%, rgba(14,17,23,0.55) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(14,17,23,0.35) 0%, rgba(14,17,23,0) 30%, rgba(14,17,23,0) 65%, rgba(14,17,23,0.7) 100%)",
        }}
      />
    </div>
  );
}

function LiveHealthPill() {
  const { data } = useHealth();
  const bucket = data?.latest_heat_bucket;
  return (
    <div
      data-testid="hero-health"
      className="inline-flex items-center gap-2 rounded-sm border hairline bg-background/60 px-2.5 py-1 mono text-[10px] uppercase tracking-widest text-neutral-300 backdrop-blur"
    >
      <Radio className="h-3 w-3 text-[hsl(25,95%,60%)]" />
      live
      <span className="text-neutral-500">·</span>
      <span className="text-neutral-200">
        {bucket ? `as of ${formatRelativeFromISO(bucket)}` : "warming up…"}
      </span>
    </div>
  );
}

function TrendingPreview() {
  const q = useTopics({ limit: 3 });
  const topics = q.data?.data || [];

  return (
    <section data-testid="trending-preview" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Right now
          </div>
          <h2
            className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-50"
            style={{ letterSpacing: "-0.02em" }}
          >
            The three hottest topics this hour
          </h2>
        </div>
        <Link
          to="/trending"
          data-testid="see-all-trending"
          className="hidden sm:inline-flex items-center gap-1 rounded-sm border hairline px-3 py-1.5 mono text-[11px] uppercase tracking-widest text-neutral-200 hover:bg-secondary"
        >
          see all trending
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {q.isLoading &&
          [0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-sm border hairline bg-secondary/20 animate-pulse" />
          ))}
        {!q.isLoading &&
          topics.map((t, i) => (
            <Link
              key={t.topic_id}
              to={`/topic/${t.topic_id}`}
              data-testid={`hero-topic-${t.topic_id}`}
              className="group flex flex-col justify-between rounded-sm border hairline bg-background/50 p-4 no-underline transition-colors hover:bg-secondary/40"
            >
              <div>
                <div className="mono text-[10px] uppercase tracking-widest text-neutral-500">
                  #{i + 1}
                </div>
                <div className="mt-1 text-base font-medium text-neutral-50 group-hover:text-white">
                  {safeName(t)}
                </div>
                {t.summary && (
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-400 line-clamp-2">
                    {t.summary}
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusChip status={t.status} />
                  {t.sector && (
                    <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {t.sector}
                    </span>
                  )}
                </div>
                <HeatBadge
                  percentile={t.heat_percentile}
                  confidence={t.heat_confidence}
                  size="sm"
                />
              </div>
            </Link>
          ))}
      </div>

      <Link
        to="/trending"
        className="mt-4 inline-flex items-center gap-1 mono text-[11px] uppercase tracking-widest text-neutral-300 hover:text-neutral-50 sm:hidden"
      >
        see all trending <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}

function Roadmap() {
  return (
    <section data-testid="roadmap" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        The instrument, honestly
      </div>
      <h2
        className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-50"
        style={{ letterSpacing: "-0.02em" }}
      >
        What's live, and what's on the way
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-sm border hairline bg-background/40 p-5">
          <div className="mono text-[10px] uppercase tracking-widest text-[hsl(140,55%,60%)]">
            live now
          </div>
          <ul className="mt-3 space-y-2 text-sm text-neutral-200">
            <li>Semantic heat map with fixed geography — signals cluster where they belong.</li>
            <li>Ranked trending feed with sector filters, text search, and pagination.</li>
            <li>Topic detail with velocity, acceleration, sentiment, and related topics.</li>
            <li>Every heat score paired with its confidence — provisional-looking means provisional.</li>
            <li>Shareable URLs — window, timestamp, and focus travel with the link.</li>
          </ul>
        </div>
        <div className="rounded-sm border hairline bg-background/40 p-5">
          <div className="mono text-[10px] uppercase tracking-widest text-[hsl(25,95%,60%)]">
            coming soon
          </div>
          <ul className="mt-3 space-y-2 text-sm text-neutral-200">
            <li>
              <span className="text-neutral-50">7-day heat timelapse.</span>{" "}
              <span className="text-muted-foreground">
                An ambient loop showing where attention has moved this week. This landing page's
                hero becomes the animation.
              </span>
            </li>
            <li>
              <span className="text-neutral-50">Region investigation.</span>{" "}
              <span className="text-muted-foreground">
                Click any hot region for the topics inside it, with a statistical coherence read.
              </span>
            </li>
            <li>
              <span className="text-neutral-50">3D peek view.</span>{" "}
              <span className="text-muted-foreground">
                Extruded hex prisms for pitch/rotate exploration of the same map.
              </span>
            </li>
            <li>
              <span className="text-neutral-50">More sources.</span>{" "}
              <span className="text-muted-foreground">
                Twitter, Reddit, Threads — signal beyond a single platform.
              </span>
            </li>
            <li>
              <span className="text-neutral-50">Signed-in Pro tier.</span>{" "}
              <span className="text-muted-foreground">
                Time travel, extended windows, AI cluster summaries.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function HonestyStatement() {
  return (
    <section
      data-testid="honesty"
      className="mx-auto mt-24 mb-16 max-w-4xl px-4 sm:px-6 text-center"
    >
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        The rule
      </div>
      <p
        className="mt-2 text-xl sm:text-2xl leading-relaxed text-neutral-100"
        style={{ letterSpacing: "-0.01em" }}
      >
        Heat is a relative attention signal, not a verified fact. Every score ships with its
        confidence. Nothing here is a call to action — it's a read on where things are moving.
      </p>
      <div className="mt-4 mono text-[10px] uppercase tracking-widest text-neutral-500">
        Pulse · Calescent Labs
      </div>
    </section>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const hasKey = Boolean(process.env.REACT_APP_PULSE_KEY_FREE);

  // Scroll cue — softly fade the hero content once user starts scrolling.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AppShell dense>
      <div data-testid="landing-page" className="relative">
        {/* Hero */}
        <section
          data-testid="hero"
          className="relative flex min-h-[calc(100vh-104px)] items-center overflow-hidden"
        >
          <AmbientHeat />

          <div
            className={`relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 transition-opacity duration-500 ${
              scrolled ? "opacity-95" : "opacity-100"
            }`}
          >
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-sm border hairline bg-background/60 px-2.5 py-1 mono text-[10px] uppercase tracking-[0.22em] text-neutral-300 backdrop-blur">
                <Sparkles className="h-3 w-3 text-[hsl(25,95%,60%)]" />
                a semantic map of attention
              </div>

              <h1
                data-testid="hero-title"
                className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-neutral-50"
                style={{ letterSpacing: "-0.03em", lineHeight: 1.02 }}
              >
                Attention,
                <br />
                <span className="heat-3">accelerating.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-neutral-300">
                A live read on what's beginning to spread online, before it's obvious. Pulse
                clusters public content into topics, tracks how fast each is picking up, and lets
                you watch the map breathe. An instrument, not a hype machine.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  data-testid="cta-open-map"
                  onClick={() => navigate("/map")}
                  className="inline-flex items-center gap-2 rounded-sm bg-[hsl(25,95%,60%)] px-4 py-2.5 text-sm font-medium text-[hsl(220,15%,7%)] transition-transform hover:translate-y-[-1px]"
                >
                  Open the map
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  to="/trending"
                  data-testid="cta-see-trending"
                  className="inline-flex items-center gap-2 rounded-sm border hairline bg-background/60 px-4 py-2.5 text-sm text-neutral-100 backdrop-blur transition-colors hover:bg-secondary"
                >
                  See trending
                </Link>
                <LiveHealthPill />
              </div>

              <p className="mt-5 mono text-[10px] uppercase tracking-widest text-neutral-500">
                heat behind · 7-day snapshot · full timelapse animation coming
              </p>
            </div>
          </div>

          {/* Scroll hint */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center transition-opacity duration-500 ${
              scrolled ? "opacity-0" : "opacity-70"
            }`}
          >
            <div className="mono text-[9px] uppercase tracking-[0.3em] text-neutral-500">
              scroll · look closer
            </div>
          </div>
        </section>

        {!hasKey && (
          <div className="mx-auto mt-8 max-w-3xl px-4">
            <NoKeyState />
          </div>
        )}

        <TrendingPreview />
        <Roadmap />
        <HonestyStatement />
      </div>
    </AppShell>
  );
}
