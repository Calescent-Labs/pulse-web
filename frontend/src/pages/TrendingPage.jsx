import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Lock, Search, Sparkles, X } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { HeatBadge } from "../components/HeatBadge";
import { SentimentIndicator } from "../components/SentimentIndicator";
import { StatusChip } from "../components/StatusChip";
import { LockedFeature } from "../components/LockedFeature";
import { ErrorState } from "../components/ErrorState";
import { NoKeyState } from "../components/NoKeyState";
import { useSectors, useTopics } from "../lib/queries";
import { useTier } from "../lib/tierContext";
import { formatCompact, safeName } from "../lib/format";

const PAGE_SIZE = 30;
const RECENT_KEY = "pulse:recentSearches";
const RECENT_LIMIT = 3;

function loadRecentSearches() {
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string").slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function pushRecentSearch(term) {
  try {
    if (!term || term.length < 2) return;
    const current = loadRecentSearches();
    const next = [term, ...current.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("pulse:recentSearchesChanged"));
  } catch {
    /* localStorage blocked — silent */
  }
}

const STATUSES = [
  { v: "emerging", label: "Emerging" },
  { v: "accelerating", label: "Accelerating" },
  { v: "peaking", label: "Peaking" },
  { v: "declining", label: "Declining" },
  { v: "resurfaced", label: "Resurfaced" },
  { v: "dormant", label: "Dormant" },
];

const SENTIMENTS = [
  { v: "", label: "any" },
  { v: "positive", label: "positive", subtitle: "mean > +0.15" },
  { v: "neutral", label: "neutral", subtitle: "|mean| ≤ 0.15" },
  { v: "negative", label: "negative", subtitle: "mean < −0.15" },
  { v: "divided", label: "divided", subtitle: "|mean| < 0.15 and polarisation > 0.35 — a split audience, not indifference" },
];

function useDebounced(value, delay) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function ProDropdown({ label, value, options, onChange, testid, unlocked, disabled }) {
  const [open, setOpen] = useState(false);
  const displayValue = options.find((o) => o.v === value)?.label ?? value ?? "all";
  if (!unlocked) return null;
  return (
    <div className="relative">
      <button
        data-testid={testid}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-sm border hairline bg-background/60 px-2.5 py-1.5 mono text-[11px] uppercase tracking-widest text-neutral-200 hover:bg-secondary disabled:opacity-40"
      >
        <span className="text-muted-foreground">{label}</span>
        <span>{displayValue || "all"}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 min-w-56 rounded-sm border hairline bg-background/95 p-1 backdrop-blur">
          {options.map((o) => (
            <button
              key={o.v || "_all"}
              data-testid={o.v ? `${testid}-opt-${o.v}` : undefined}
              onClick={() => {
                onChange(o.v);
                setOpen(false);
              }}
              className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-secondary"
            >
              <div className="mono text-[11px] uppercase tracking-widest text-neutral-200">
                {o.label}
              </div>
              {o.subtitle && (
                <div className="mt-0.5 mono text-[10px] normal-case tracking-normal text-muted-foreground">
                  {o.subtitle}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectorFilter({ value, onChange }) {
  const { tier } = useTier();
  const { data, error } = useSectors();
  if (tier === "free" || (error && error.code === 402)) {
    return <LockedFeature feature="sector filter" compact />;
  }
  if (error) return <ErrorState error={error} title="Sectors unavailable" />;
  const options = [
    { v: "", label: "all" },
    ...(data?.data || []).map((s) => ({ v: s.sector, label: `${s.sector} (${s.topic_count})` })),
  ];
  return (
    <ProDropdown
      testid="sector-filter"
      label="sector"
      value={value}
      options={options}
      onChange={onChange}
      unlocked
    />
  );
}

function TopicRow({ topic, rank, locked }) {
  const isDivided =
    topic.sentiment &&
    topic.sentiment.mean != null &&
    Math.abs(topic.sentiment.mean) < 0.15 &&
    (topic.sentiment.polarisation ?? 0) > 0.35;

  const blurStyle = locked
    ? { filter: "blur(5px) grayscale(0.35)", opacity: 0.75 }
    : undefined;

  const RowLink = ({ children, className }) =>
    locked ? (
      <div className={className} aria-hidden="true">
        {children}
      </div>
    ) : (
      <Link
        to={`/topic/${topic.topic_id}`}
        data-testid={`topic-link-${topic.topic_id}`}
        className={className}
      >
        {children}
      </Link>
    );

  return (
    <li
      data-testid={`topic-row-${topic.topic_id}`}
      data-locked={locked ? "true" : "false"}
      className={`grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b hairline px-3 py-3 sm:grid-cols-[36px_1fr_150px_180px_120px] sm:gap-4 ${
        locked ? "bg-secondary/10" : "hover:bg-secondary/30"
      }`}
    >
      <div className="mono text-xs text-muted-foreground text-right">
        {locked ? (
          <span className="inline-flex items-center gap-1">
            #{rank}
            <Lock className="h-2.5 w-2.5" />
          </span>
        ) : (
          <>#{rank}</>
        )}
      </div>
      <div className="min-w-0" style={blurStyle}>
        <RowLink className="block truncate text-sm font-medium text-neutral-50 no-underline hover:text-white">
          {safeName(topic)}
        </RowLink>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusChip status={topic.status} />
          {topic.sector && (
            <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {topic.sector}
              {topic.subsector ? ` · ${topic.subsector}` : ""}
            </span>
          )}
          <span className="mono text-[10px] text-muted-foreground">
            {formatCompact(topic.member_count)} items
          </span>
          {isDivided && (
            <span className="mono text-[10px] uppercase tracking-widest heat-3">divided</span>
          )}
        </div>
      </div>
      <div className="hidden sm:block" style={blurStyle}>
        <HeatBadge percentile={topic.heat_percentile} confidence={topic.heat_confidence} />
      </div>
      <div className="hidden sm:block" style={blurStyle}>
        <SentimentIndicator
          mean={topic.sentiment?.mean}
          polarisation={topic.sentiment?.polarisation}
          sampleSize={topic.sentiment?.sample_size}
        />
      </div>
      <div className="hidden sm:block" style={blurStyle}>
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">velocity</div>
        <div className="mono text-xs text-neutral-100">
          {topic.signals?.velocity != null ? topic.signals.velocity.toFixed(4) : "—"}
        </div>
      </div>
      {/* Mobile summary */}
      <div className="col-span-3 flex items-center gap-3 sm:hidden" style={blurStyle}>
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
    </li>
  );
}

export default function TrendingPage() {
  const { tier } = useTier();
  const isPro = tier === "pro";
  const [params, setParams] = useSearchParams();
  const [sector, setSector] = useState("");
  const [minConf, setMinConf] = useState(0);
  const [status, setStatus] = useState("");
  const [sentiment, setSentiment] = useState("");
  // qInput is a local input mirror; the URL param `?q=` is the source of truth.
  const urlQ = params.get("q") || "";
  const [qInput, setQInput] = useState(urlQ);
  const q = useDebounced(qInput, 250).trim();
  const [page, setPage] = useState(0);
  const [recent, setRecent] = useState(() => loadRecentSearches());

  // Sync URL → local input when the URL changes externally (chip click, back/forward).
  useEffect(() => {
    if (urlQ !== qInput) setQInput(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ]);

  // Sync local (debounced) q → URL. Use `replace` while typing so continuous
  // keystrokes don't spam history — chip clicks below use `push` so the back
  // button walks discrete searches.
  useEffect(() => {
    if (q === urlQ) return;
    const next = new URLSearchParams(params);
    if (q) next.set("q", q);
    else next.delete("q");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Commit successful (>=2 char) queries into the recent list, debounced.
  useEffect(() => {
    if (q && q.length >= 2) {
      pushRecentSearch(q);
      setRecent(loadRecentSearches());
    }
  }, [q]);

  // Sync when other tabs / components update the list.
  useEffect(() => {
    const onChange = () => setRecent(loadRecentSearches());
    window.addEventListener("pulse:recentSearchesChanged", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("pulse:recentSearchesChanged", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // Reset to page 0 whenever filters change
  useEffect(() => {
    setPage(0);
  }, [sector, minConf, status, sentiment, q]);

  const request = useTopics({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sector: isPro && sector ? sector : undefined,
    status: isPro && status ? status : undefined,
    sentiment: isPro && sentiment ? sentiment : undefined,
    min_confidence: minConf || undefined,
    q: q && q.length >= 2 ? q : undefined,
  });

  const topics = request.data?.data || [];
  const meta = request.data?.meta;
  const pagination = meta?.pagination;
  const disclaimer = meta?.disclaimer;
  const hasKey = Boolean(process.env.REACT_APP_PULSE_KEY_FREE);
  const FREE_VISIBLE = 3;
  const lockedCount = !isPro && topics.length > FREE_VISIBLE ? topics.length - FREE_VISIBLE : 0;

  const emptyCopy = useMemo(() => {
    if (sentiment) {
      return "Sentiment filtering is sparse today — many topics don't have enough comment data yet for a reading.";
    }
    if (q) return `No topics match "${q}".`;
    if (sector || status || minConf) return "No topics match these filters.";
    return "No topics right now.";
  }, [sentiment, q, sector, status, minConf]);

  const anyFilterActive = Boolean(sector || status || sentiment || q || minConf);

  return (
    <AppShell disclaimer={disclaimer}>
      <div data-testid="trending-page" className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Ranked feed
            </div>
            <h1
              className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-50"
              style={{ letterSpacing: "-0.02em" }}
            >
              Trending on the internet right now
            </h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-400">
              The topics gaining the most attention across the open web in the last 24 hours.
              Click any topic to see the actual content — then open it at its source.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              data-testid="search-input"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search topics, entities, summaries…"
              className="w-full rounded-sm border hairline bg-background/60 py-2 pl-8 pr-8 text-sm text-neutral-100 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(25_95%_55%)]"
            />
            {qInput && (
              <button
                data-testid="search-clear"
                onClick={() => setQInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-neutral-100"
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {qInput && qInput.length < 2 && (
            <div className="mt-1 mono text-[10px] uppercase tracking-widest text-neutral-500">
              type at least 2 characters
            </div>
          )}
          {recent.length > 0 && !qInput && (
            <div
              data-testid="search-recents"
              className="mt-2 flex flex-wrap items-center gap-1.5"
            >
              <span className="mono text-[10px] uppercase tracking-widest text-neutral-500">
                recent
              </span>
              {recent.map((r) => (
                <button
                  key={r}
                  data-testid={`recent-${r}`}
                  onClick={() => {
                    // Push a new history entry so the browser back button walks
                    // yesterday's investigations naturally.
                    const next = new URLSearchParams(params);
                    next.set("q", r);
                    setParams(next);
                    setQInput(r);
                  }}
                  className="inline-flex items-center gap-1 rounded-sm border hairline bg-background/60 px-2 py-0.5 text-xs text-neutral-200 hover:bg-secondary"
                  title={`Re-run search for "${r}"`}
                >
                  <Search className="h-2.5 w-2.5 text-muted-foreground" />
                  {r}
                </button>
              ))}
              <button
                data-testid="recent-clear"
                onClick={() => {
                  try {
                    localStorage.removeItem(RECENT_KEY);
                  } catch {
                    /* no-op */
                  }
                  setRecent([]);
                }}
                className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-neutral-100"
              >
                clear
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SectorFilter value={sector} onChange={setSector} />
          {isPro ? (
            <ProDropdown
              testid="status-filter"
              label="status"
              value={status}
              onChange={setStatus}
              options={[{ v: "", label: "all" }, ...STATUSES.map((s) => ({ v: s.v, label: s.label.toLowerCase() }))]}
              unlocked
            />
          ) : (
            <LockedFeature feature="status filter" compact />
          )}
          {isPro ? (
            <ProDropdown
              testid="sentiment-filter"
              label="sentiment"
              value={sentiment}
              onChange={setSentiment}
              options={SENTIMENTS}
              unlocked
            />
          ) : (
            <LockedFeature feature="sentiment filter" compact />
          )}
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
          {anyFilterActive && (
            <button
              data-testid="clear-filters"
              onClick={() => {
                setSector("");
                setStatus("");
                setSentiment("");
                setMinConf(0);
                setQInput("");
              }}
              className="inline-flex items-center gap-1 rounded-sm border hairline bg-background/60 px-2 py-1.5 mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-neutral-100"
            >
              <X className="h-3 w-3" />
              clear
            </button>
          )}
          {status && isPro && (
            <span
              data-testid="status-caveat"
              className="mono text-[10px] uppercase tracking-widest text-amber-300"
              title="Every topic is 'emerging' today — the full lifecycle classifier ships later"
            >
              lifecycle stages roll out later
            </span>
          )}
        </div>

        <div className="mt-6 rounded-sm border hairline bg-background/40">
          <div
            className="hidden sm:grid grid-cols-[36px_1fr_150px_180px_120px] items-center gap-4 border-b hairline px-3 py-2 mono text-[10px] uppercase tracking-widest text-muted-foreground"
            aria-hidden="true"
          >
            <div className="text-right">#</div>
            <div>Topic</div>
            <div>Heat · Conf</div>
            <div>Sentiment</div>
            <div>Velocity</div>
          </div>

          {!hasKey ? (
            <div className="p-4">
              <NoKeyState />
            </div>
          ) : request.isError ? (
            <div className="p-4">
              <ErrorState error={request.error} />
            </div>
          ) : request.isLoading && !request.data ? (
            <div className="p-6 text-center mono text-xs text-muted-foreground">
              loading ranked topics…
            </div>
          ) : topics.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {emptyCopy}
            </div>
          ) : (
            <ol data-testid="topics-list">
              {topics.map((t, i) => (
                <TopicRow
                  key={t.topic_id}
                  topic={t}
                  rank={page * PAGE_SIZE + i + 1}
                  locked={!isPro && i >= FREE_VISIBLE}
                />
              ))}
            </ol>
          )}

          {/* Free-tier caveat — visible under the list when there are locked rows */}
          {!isPro && lockedCount > 0 && !request.isError && (
            <div
              data-testid="trending-pro-caveat"
              className="border-t hairline bg-secondary/40 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-[hsl(25,95%,60%)]" />
                <span className="mono text-[10px] uppercase tracking-[0.18em] text-neutral-100">
                  {lockedCount} more topic{lockedCount === 1 ? "" : "s"} on this page
                </span>
                <span className="mono text-[10px] text-neutral-500">·</span>
                <span className="mono text-[10px] uppercase tracking-widest text-[hsl(25,95%,60%)]">
                  coming with Pro
                </span>
              </div>
              <div className="mt-1 mono text-[10px] text-muted-foreground normal-case tracking-normal">
                The full list — every trending topic across the internet — unlocks with Pro.
              </div>
            </div>
          )}

          {/* Pagination footer */}
          {pagination && (
            <div className="flex items-center justify-between gap-3 border-t hairline px-3 py-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <div>
                <span className="text-neutral-200">
                  {topics.length > 0 ? page * PAGE_SIZE + 1 : 0}–{page * PAGE_SIZE + topics.length}
                </span>
                <span className="mx-1">/</span>
                <span className="text-neutral-200">{pagination.total}</span> topics
              </div>
              <div className="flex items-center gap-1">
                <button
                  data-testid="page-prev"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || request.isFetching}
                  className="inline-flex items-center gap-1 rounded-sm border hairline px-2 py-1 text-neutral-200 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3 w-3" /> prev
                </button>
                <button
                  data-testid="page-next"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.has_more || request.isFetching}
                  className="inline-flex items-center gap-1 rounded-sm border hairline px-2 py-1 text-neutral-200 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  next <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
