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

export function useMapTimelapse({ days = 7, resolution = "4h", grid = 40, window } = {}) {
  const { apiKey, tier } = useTier();
  return useQuery({
    queryKey: ["timelapse", { days, resolution, grid, window, tier }],
    queryFn: ({ signal }) => getMapTimelapse({ days, resolution, grid, window, apiKey, signal }),
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
