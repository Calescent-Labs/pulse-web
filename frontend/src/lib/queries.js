import { useQuery } from "@tanstack/react-query";
import { getHealth, getMap, getSectors, getTopic, getTopics } from "./pulseClient";
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

export function useTopics({ limit = 30, offset = 0, min_confidence, sector } = {}) {
  const { apiKey, tier } = useTier();
  return useQuery({
    queryKey: ["topics", { limit, offset, min_confidence, sector, tier }],
    queryFn: ({ signal }) => getTopics({ limit, offset, min_confidence, sector, apiKey, signal }),
    enabled: Boolean(apiKey),
    staleTime: 60_000,
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

export function useMap({ window, asof, limit }) {
  const { apiKey, tier } = useTier();
  return useQuery({
    queryKey: ["map", { window, asof, limit, tier }],
    queryFn: ({ signal }) => getMap({ window, asof, limit, apiKey, signal }),
    enabled: Boolean(apiKey),
    staleTime: 60_000,
    retry: (failureCount, err) => {
      if (err && (err.code === 401 || err.code === 402)) return false;
      return failureCount < 1;
    },
    // The scrubber changes asof frequently — keep previous data during
    // transitions so the map doesn't flash empty. React Query v5:
    placeholderData: (prev) => prev,
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
