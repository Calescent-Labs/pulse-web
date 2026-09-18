// Session latch: a pause cannot be undone by a late, older health response.
let paused = false;
const listeners = new Set();
export const isDataPaused = () => paused;
export function subscribeDataAvailability(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function clearLegacyTimelapse() {
  try { localStorage.removeItem("pulse:timelapse:v1"); } catch (_) { /* storage unavailable */ }
  if (typeof window !== "undefined") window.__PULSE_TIMELAPSE_PROMISE__ = null;
}
export function markDataPaused() {
  clearLegacyTimelapse();
  if (paused) return;
  paused = true;
  listeners.forEach((listener) => listener());
}
export function isContainmentResponse(status, body) {
  return status === 503 && body?.error?.code === "data_unavailable" &&
    body?.error?.reason === "youtube_containment";
}
export function healthPausesData(health) {
  return health?.data_available === false || health?.containment === "youtube_containment";
}
export function isAnalyticalQuery(query) {
  return ["topics", "topic", "neighbours", "map", "timelapse", "region", "sectors"]
    .includes(query.queryKey[0]);
}
