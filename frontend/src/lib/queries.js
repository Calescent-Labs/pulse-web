import { useQuery } from "@tanstack/react-query";
import {
  getHealth,
  getMap,
  getMapRegion,
  getMapTimelapse,
  getNeighbours,
  getSectors,
  getTopic,
  getTopics,
} from "./pulseClient";
import { useTier } from "./tierContext";

// Data updates hourly server-side and is cached 5 min; we set staleTime to
// 60s so we don't over-fetch. Do not poll faster than once a minute.

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getHealth(signal),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
}

export function useTopics({ limit = 30, offset = 0, min_confidence, sector, q, status, sentiment } = {}) {
  const { apiKey, tier } = useTier();
  return useQuery({
    queryKey: ["topics", { limit, offset, min_confidence, sector, q, status, sentiment, tier }],
    queryFn: ({ signal }) =>
      getTopics({ limit, offset, min_confidence, sector, q, status, sentiment, apiKey, signal }),
    enabled: Boolean(apiKey),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    retry: (failureCount, err) => {
      if (err && (err.code === 401 || err.code === 402)) return false;
      return failureCount < 1;
    },
  });
}

export function useTopic({ topicId, history_hours = 24, members = 20 }) {
  const { apiKey, tier } = useTier();
  return useQuery({
    queryKey: ["topic", topicId, { history_hours, members, tier }],
    queryFn: ({ signal }) => getTopic({ topicId, history_hours, members, apiKey, signal }),
    enabled: Boolean(apiKey) && Number.isFinite(topicId),
    staleTime: 60_000,
    retry: (failureCount, err) => {
      if (err && (err.code === 401 || err.code === 402 || err.code === 404)) return false;
      return failureCount < 1;
    },
  });
}

export function useNeighbours({ topicId, limit = 6 }) {
  const { apiKey } = useTier();
  return useQuery({
    queryKey: ["neighbours", topicId, limit],
    queryFn: ({ signal }) => getNeighbours({ topicId, limit, apiKey, signal }),
    enabled: Boolean(apiKey) && Number.isFinite(topicId),
    staleTime: 5 * 60_000,
    retry: (failureCount, err) => {
      if (err && (err.code === 401 || err.code === 402 || err.code === 404)) return false;
      return failureCount < 1;
    },
  });
}

export function useMap({ window, asof, limit, mode, percentile, topic_id, aggregated, resolution, points }) {
  const { apiKey, tier } = useTier();
  return useQuery({
    queryKey: ["map", { window, asof, limit, mode, percentile, topic_id, aggregated, resolution, points, tier }],
    queryFn: ({ signal }) =>
      getMap({ window, asof, limit, mode, percentile, topic_id, aggregated, resolution, points, apiKey, signal }),
    enabled: Boolean(apiKey),
    staleTime: 60_000,
    retry: (failureCount, err) => {
      if (err && (err.code === 401 || err.code === 402)) return false;
      return failureCount < 1;
    },
    // The scrubber changes asof frequently — keep previous data during
    // transitions so the map doesn't flash empty.
    placeholderData: (prev) => prev,
  });
}

// LocalStorage cache for the landing-hero timelapse. On repeat visits we
// paint from cache immediately (<50ms) while React Query kicks off a
// background refresh. Cache TTL matches the server's ~1h recompute; a
// slightly stale hero heat is fine, and the fresh data swaps in on arrival.
const TIMELAPSE_CACHE_KEY = "pulse:timelapse:v1";
const TIMELAPSE_CACHE_TTL_MS = 60 * 60 * 1000;

function readTimelapseCache() {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const raw = localStorage.getItem(TIMELAPSE_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data || !parsed.ts) return undefined;
    if (Date.now() - parsed.ts > TIMELAPSE_CACHE_TTL_MS) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeTimelapseCache(data) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      TIMELAPSE_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch {
    /* quota exceeded / private mode — silent */
  }
}

export function useMapTimelapse({ days = 7, resolution = "4h", grid = 40, window } = {}) {
  const { apiKey, tier } = useTier();
  const isDefault = days === 7 && resolution === "4h" && grid === 40 && !window;
  return useQuery({
    queryKey: ["timelapse", { days, resolution, grid, window, tier }],
    queryFn: async ({ signal }) => {
      const data = await getMapTimelapse({ days, resolution, grid, window, apiKey, signal });
      // Only cache the canonical hero payload — other param combos would
      // thrash the single-slot cache with no benefit.
      if (isDefault && data) writeTimelapseCache(data);
      return data;
    },
    // Instant-paint from localStorage on repeat visits; RQ will still
    // background-refresh because staleTime says the cache is stale.
    initialData: isDefault ? readTimelapseCache : undefined,
    initialDataUpdatedAt: () => {
      if (!isDefault) return undefined;
      try {
        const raw =
          typeof localStorage !== "undefined" && localStorage.getItem(TIMELAPSE_CACHE_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        return parsed?.ts;
      } catch {
        return undefined;
      }
    },
    enabled: Boolean(apiKey),
    // Precomputed once per hour server-side — a longer stale window is fine.
    staleTime: 5 * 60_000,
    retry: (failureCount, err) => {
      if (err && (err.code === 401 || err.code === 402)) return false;
      return failureCount < 1;
    },
  });
}

export function useMapRegion({ x, y, radius, window, asof, limit, enabled = true }) {
  const { apiKey, tier } = useTier();
  return useQuery({
    queryKey: ["region", { x, y, radius, window, asof, limit, tier }],
    queryFn: ({ signal }) => getMapRegion({ x, y, radius, window, asof, limit, apiKey, signal }),
    enabled: Boolean(apiKey) && enabled && Number.isFinite(x) && Number.isFinite(y),
    staleTime: 60_000,
    retry: (failureCount, err) => {
      if (err && (err.code === 401 || err.code === 402 || err.code === 404)) return false;
      return failureCount < 1;
    },
  });
}

export function useSectors() {
  const { apiKey, tier } = useTier();
  return useQuery({
    queryKey: ["sectors", tier],
    queryFn: ({ signal }) => getSectors({ apiKey, signal }),
    enabled: Boolean(apiKey),
    staleTime: 5 * 60_000,
    retry: (failureCount, err) => {
      if (err && (err.code === 401 || err.code === 402)) return false;
      return failureCount < 1;
    },
  });
}
