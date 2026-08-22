// Pulse API data-access module.
// All fetching lives here. Components MUST NOT call fetch/axios directly.
// Base URL and keys come from env config only (see /app/frontend/.env).
//
// Types are documented via JSDoc from DATA_CONTRACT.md; treat all fields as
// nullable unless the contract guarantees otherwise. Additive fields may
// appear in v1 — nothing here will be removed.

/**
 * @typedef {'free'|'pro'} Tier
 *
 * @typedef {Object} Signals
 * @property {number} velocity
 * @property {number} acceleration
 * @property {number} breadth
 * @property {number} freshness
 *
 * @typedef {Object} Sentiment
 * @property {number|null} mean
 * @property {number|null} polarisation
 * @property {number|null} sample_size
 *
 * @typedef {Object} Topic
 * @property {number} topic_id
 * @property {string|null} name
 * @property {string|null} sector
 * @property {string|null} subsector
 * @property {'emerging'|'accelerating'|'peaking'|'declining'|'resurfaced'|'dormant'|null} status
 * @property {string|null} summary
 * @property {string[]|null} entities
 * @property {number} heat_percentile
 * @property {number} heat_confidence
 * @property {Signals} signals
 * @property {Sentiment} sentiment
 * @property {Record<string, number>} platform_mix
 * @property {number} member_count
 * @property {string} as_of
 *
 * @typedef {Object} TopicHistoryEntry
 * @property {string} bucket_ts
 * @property {number|null} heat_percentile
 * @property {number|null} heat_confidence
 * @property {number|null} velocity
 * @property {number|null} acceleration
 * @property {number|null} sentiment
 *
 * @typedef {Object} TopicMember
 * @property {string} title
 * @property {string} url
 * @property {string} platform
 * @property {string} channel
 * @property {string} published_at
 * @property {'live'|'edited'|'removed'|'privated'} status
 * @property {number} views
 *
 * @typedef {Topic & { history: TopicHistoryEntry[], members: TopicMember[] }} TopicDetail
 *
 * @typedef {Object} MapPoint
 * @property {string} id
 * @property {string} title
 * @property {string} platform
 * @property {string} channel
 * @property {number} age_hours
 * @property {number|null} topic_id
 * @property {number} views
 * @property {number} x
 * @property {number} y
 *
 * @typedef {Object} MapPayload
 * @property {MapPoint[]} points
 * @property {number} reference_size
 * @property {number} duplicates_collapsed
 * @property {string} [note]
 *
 * @typedef {Object} SectorEntry
 * @property {string} sector
 * @property {number} topic_count
 *
 * @typedef {Object} Health
 * @property {string} status
 * @property {string} version
 * @property {string} latest_heat_bucket
 *
 * @typedef {Object} Meta
 * @property {string} version
 * @property {Tier} tier
 * @property {string} generated_at
 * @property {string} disclaimer
 * @property {string} [window]
 * @property {string} [as_of]
 *
 * @typedef {Object} Envelope
 * @property {any} data
 * @property {Meta} meta
 */

const BASE_URL = (process.env.REACT_APP_PULSE_API_BASE || "").replace(/\/+$/, "");

/** Error thrown for 402 pro_required responses — treated as a UI state. */
export class PulseLockedError extends Error {
  constructor(feature, message) {
    super(message || `Pro feature required: ${feature}`);
    this.name = "PulseLockedError";
    this.code = 402;
    this.feature = feature || "this capability";
  }
}

/** Error thrown for missing/invalid X-API-Key. */
export class PulseAuthError extends Error {
  constructor(msg) {
    super(msg || "invalid or missing X-API-Key");
    this.name = "PulseAuthError";
    this.code = 401;
  }
}

/** Error thrown when the backend reports degraded state. */
export class PulseDegradedError extends Error {
  constructor() {
    super("backend degraded or insufficient data");
    this.name = "PulseDegradedError";
    this.code = 503;
  }
}

/** Error thrown for rate limiting. */
export class PulseRateLimitError extends Error {
  constructor() {
    super("rate limit exceeded — try again in a moment");
    this.name = "PulseRateLimitError";
    this.code = 429;
  }
}

/** Generic Pulse API error. */
export class PulseApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.name = "PulseApiError";
    this.code = status;
    this.detail = detail;
  }
}

function buildUrl(path, params) {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function request(path, { params, apiKey, signal } = {}) {
  if (!BASE_URL) {
    throw new PulseApiError(0, "REACT_APP_PULSE_API_BASE is not configured");
  }
  const headers = { Accept: "application/json" };
  if (apiKey) headers["X-API-Key"] = apiKey;

  const res = await fetch(buildUrl(path, params), { headers, signal });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON body — leave body null.
  }

  if (res.ok) return body;

  const detail = body && body.detail;
  if (res.status === 401) throw new PulseAuthError(typeof detail === "string" ? detail : undefined);
  if (res.status === 402) {
    const feature = detail && typeof detail === "object" ? detail.feature : "this capability";
    const message = detail && typeof detail === "object" ? detail.message : undefined;
    throw new PulseLockedError(feature, message);
  }
  if (res.status === 429) throw new PulseRateLimitError();
  if (res.status === 503) throw new PulseDegradedError();
  throw new PulseApiError(res.status, detail || body || res.statusText);
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/** GET /v1/health (no auth) */
export function getHealth(signal) {
  return request("/v1/health", { signal });
}

/**
 * GET /v1/topics — ranked feed.
 * @param {{limit?:number, offset?:number, min_confidence?:number, sector?:string, apiKey:string, signal?:AbortSignal}} opts
 */
export function getTopics({ limit, offset, min_confidence, sector, apiKey, signal }) {
  return request("/v1/topics", {
    params: { limit, offset, min_confidence, sector },
    apiKey,
    signal,
  });
}

/**
 * GET /v1/topics/{id} — topic detail.
 * @param {{topicId:number, history_hours?:number, members?:number, apiKey:string, signal?:AbortSignal}} opts
 */
export function getTopic({ topicId, history_hours, members, apiKey, signal }) {
  return request(`/v1/topics/${topicId}`, {
    params: { history_hours, members },
    apiKey,
    signal,
  });
}

/**
 * GET /v1/map — the semantic map.
 * @param {{window?:'24h'|'72h'|'7d'|'30d', asof?:string, limit?:number, apiKey:string, signal?:AbortSignal}} opts
 */
export function getMap({ window: win, asof, limit, apiKey, signal }) {
  return request("/v1/map", {
    params: { window: win, asof, limit },
    apiKey,
    signal,
  });
}

/** GET /v1/sectors */
export function getSectors({ apiKey, signal }) {
  return request("/v1/sectors", { apiKey, signal });
}

export const PULSE_BASE_URL = BASE_URL;
