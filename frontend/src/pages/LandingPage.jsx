import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Radio, Sparkles } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { HeatBadge } from "../components/HeatBadge";
import { StatusChip } from "../components/StatusChip";
import { NoKeyState } from "../components/NoKeyState";
import { useHealth, useTopics } from "../lib/queries";
import { formatRelativeFromISO, safeName } from "../lib/format";

// Code-split the deck.gl-heavy timelapse layer out of the main bundle so
// the hero paint (background, fallback bloom, copy) doesn't have to wait
// for @deck.gl/aggregation-layers to parse. The static <HeroFallback />
// stands in until this chunk is ready and the timelapse data arrives.
//
// `webpackPrefetch: true` emits `<link rel="prefetch">` so the browser
// pulls this chunk during idle time after the main bundle paints —
// closing the gap between HeroFallback paint and timelapse swap-in.
const AmbientHeat = lazy(() =>
  import(/* webpackPrefetch: true */ "../components/AmbientHeat"),
);

/**
 * HeroFallback — three drifting radial-gradient orbs. Lives in the main
 * bundle so it paints within a few hundred ms of navigation, before deck.gl
 * or the timelapse fetch resolves. AmbientHeat renders on top once ready
 * and its opaque canvas covers this fallback.
 */
function HeroFallback() {
  return (
    <div
      data-testid="hero-fallback"
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ background: "#0a0d13" }}
    >
      <div
        className="absolute -left-40 top-20 h-[520px] w-[520px] rounded-full blur-3xl hero-bloom-a"
        style={{
          background: "radial-gradient(circle, hsl(268,65%,50%,0.55) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute right-10 top-40 h-[420px] w-[420px] rounded-full blur-3xl hero-bloom-b"
        style={{
          background: "radial-gradient(circle, hsl(25,95%,55%,0.5) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute left-1/3 bottom-8 h-[380px] w-[380px] rounded-full blur-3xl hero-bloom-c"
        style={{
          background: "radial-gradient(circle, hsl(340,78%,55%,0.45) 0%, transparent 70%)",
        }}
      />
      {/* Vignettes match AmbientHeat's — legibility should not change when
          the deck.gl chunk swaps in. */}
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

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Scan",
      body: "Every warm region is a topic gaining attention across the internet right now.",
    },
    {
      n: "02",
      title: "Discover",
      body: "Click any hotspot or trending topic to see what's actually inside it.",
    },
    {
      n: "03",
      title: "Jump in",
      body: "Open any piece of content at its original source. That's it — no app-hopping.",
    },
  ];
  return (
    <section
      data-testid="how-it-works"
      className="mx-auto mt-24 max-w-6xl px-4 sm:px-6"
    >
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        How Pulse works
      </div>
      <h2
        className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-50"
        style={{ letterSpacing: "-0.02em" }}
      >
        One stop. Then you're gone.
      </h2>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            data-testid={`how-step-${s.n}`}
            className="rounded-sm border hairline bg-background/40 p-4"
          >
            <div className="flex items-baseline gap-3">
              <span className="mono text-[10px] uppercase tracking-[0.22em] text-[hsl(25,95%,60%)]">
                {s.n}
              </span>
              <span className="text-base font-medium text-neutral-50">{s.title}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
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
            Trending on the internet right now
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

      <p className="mt-4 mono text-[10px] uppercase tracking-widest text-neutral-500">
        click any topic to see the actual content and open it at the source →
      </p>
    </section>
  );
}

function Roadmap() {
  return (
    <section data-testid="roadmap" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        The pitch, honestly
      </div>
      <h2
        className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-50"
        style={{ letterSpacing: "-0.02em" }}
      >
        One place for the internet's breakthroughs
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-sm border hairline bg-background/40 p-5">
          <div className="mono text-[10px] uppercase tracking-widest text-[hsl(140,55%,60%)]">
            live now
          </div>
          <ul className="mt-3 space-y-2 text-sm text-neutral-200">
            <li>
              <span className="text-neutral-50">Not just what's popular — what's accelerating.</span>{" "}
              <span className="text-muted-foreground">
                Pulse ranks by heat velocity, so you catch things while they're still on the way up.
              </span>
            </li>
            <li>
              <span className="text-neutral-50">Instead of hopping between five apps</span>{" "}
              <span className="text-muted-foreground">
                to figure out what's breaking through, watch attention accrue across the open web in one view.
              </span>
            </li>
            <li>
              <span className="text-neutral-50">See it, then jump straight to it.</span>{" "}
              <span className="text-muted-foreground">
                Every topic lists the pieces of content driving the heat — click to open them at their source.
              </span>
            </li>
            <li>
              <span className="text-neutral-50">Transparent, not clairvoyant.</span>{" "}
              <span className="text-muted-foreground">
                Every heat score ships with its confidence. Never a magic number — always the receipts.
              </span>
            </li>
            <li>
              <span className="text-neutral-50">Shareable URLs.</span>{" "}
              <span className="text-muted-foreground">
                Window, timestamp, and focus travel with the link.
              </span>
            </li>
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
                An ambient loop showing where attention has moved this week. Now live in the hero above.
              </span>
            </li>
            <li>
              <span className="text-neutral-50">Region investigation.</span>{" "}
              <span className="text-muted-foreground">
                Click any hot region for the topics inside it, with a plain-English coherence read.
              </span>
            </li>
            <li>
              <span className="text-neutral-50">Wider coverage.</span>{" "}
              <span className="text-muted-foreground">
                More corners of the open web feeding the map — signal beyond any single feed.
              </span>
            </li>
            <li>
              <span className="text-neutral-50">Signed-in Pro tier.</span>{" "}
              <span className="text-muted-foreground">
                Time travel, extended windows, cluster summaries, and richer depth per topic.
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

  // "Settle" animation — after the initial fade-in, ease the text block a
  // touch left and drift the timelapse a bit right so they stop stacking
  // over one another. Kicks in ~700ms after paint so the fade lands first.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <AppShell dense>
      <div data-testid="landing-page" className="relative">
        {/* Hero */}
        <section
          data-testid="hero"
          className="relative flex min-h-[calc(100vh-104px)] items-center overflow-hidden"
        >
          {/* Static fallback bloom — main bundle, paints immediately. */}
          <HeroFallback />
          {/* Real timelapse — code-split. Suspense fallback is null because
              HeroFallback is already visible as a sibling. AmbientHeat fades
              its own canvas in once data arrives. */}
          <Suspense fallback={null}>
            <AmbientHeat settled={settled} />
          </Suspense>

          <div
            className={`relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 transition-[opacity,transform] duration-[1600ms] ease-out ${
              scrolled ? "opacity-95" : "opacity-100"
            }`}
            style={{
              transform: settled ? "translate3d(-2.5%, 0, 0)" : "translate3d(0, 0, 0)",
              willChange: "transform",
            }}
          >
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-sm border hairline bg-background/60 px-2.5 py-1 mono text-[10px] uppercase tracking-[0.22em] text-neutral-300 backdrop-blur">
                <Sparkles className="h-3 w-3 text-[hsl(25,95%,60%)]" />
                the internet at a glance
              </div>

              <h1
                data-testid="hero-title"
                className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-neutral-50"
                style={{ letterSpacing: "-0.03em", lineHeight: 1.02 }}
              >
                The internet,
                <br />
                <span className="heat-3">before it's obvious.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-neutral-300">
                Pulse scans where audiences are gathering across the open web and surfaces
                what's actually catching fire — in one place, in one glance. Click any hotspot,
                see the real content behind it, and open it at its source. No five-tab
                app-hopping.
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
                  See what's trending
                </Link>
                <LiveHealthPill />
              </div>

              <p className="mt-5 mono text-[10px] uppercase tracking-widest text-neutral-500">
                heat behind · 7-day timelapse · 4h frames · loops continuously
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

        <HowItWorks />
        <TrendingPreview />
        <Roadmap />
        <HonestyStatement />
      </div>
    </AppShell>
  );
}
