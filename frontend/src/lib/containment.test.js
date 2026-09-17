jest.mock("./clerkBridge", () => ({ getClerkToken: jest.fn(async () => null) }));

beforeEach(() => {
  jest.resetModules();
  process.env.REACT_APP_PULSE_API_BASE = "https://api.example.test";
  localStorage.clear();
  global.fetch = jest.fn();
});
afterEach(() => { delete global.fetch; });

const response = (status, body) => ({ status, ok: status === 200, json: async () => body });
const unavailable = { error: { code: "data_unavailable", reason: "youtube_containment" }, data: null };

test("containment clears persisted timelapse, blocks subsequent requests and notifies UI", async () => {
  const state = require("./dataAvailability");
  const client = require("./pulseClient");
  const notify = jest.fn();
  state.subscribeDataAvailability(notify);
  localStorage.setItem("pulse:timelapse:v1", "historical payload");
  window.__PULSE_TIMELAPSE_PROMISE__ = Promise.resolve({ data: "old" });
  fetch.mockResolvedValue(response(503, unavailable));
  await expect(client.getTopics({})).rejects.toMatchObject({ dataUnavailable: true });
  expect(localStorage.getItem("pulse:timelapse:v1")).toBeNull();
  expect(window.__PULSE_TIMELAPSE_PROMISE__).toBeNull();
  await expect(client.getMapTimelapse({})).rejects.toMatchObject({ dataUnavailable: true });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(notify).toHaveBeenCalledTimes(1);
});

test("ordinary 503, authentication and missing historical topic retain their meaning", async () => {
  const client = require("./pulseClient");
  for (const status of [503, 401, 402, 404]) {
    fetch.mockResolvedValue(response(status, { detail: "unavailable" }));
    await expect(client.getTopic({ topicId: 1 })).rejects.toMatchObject({ code: status });
    expect(require("./dataAvailability").isDataPaused()).toBe(false);
  }
});

test("paused health is public and old healthy responses cannot release the session latch", async () => {
  const client = require("./pulseClient");
  const auth = require("./clerkBridge");
  fetch.mockResolvedValue(response(200, { status: "ok", data_available: false }));
  await client.getHealth();
  expect(auth.getClerkToken).not.toHaveBeenCalled();
  fetch.mockResolvedValue(response(200, { status: "ok" }));
  await client.getHealth();
  expect(require("./dataAvailability").isDataPaused()).toBe(true);
});

test("successful in-flight data is discarded when health reports a pause", async () => {
  const client = require("./pulseClient");
  let finish;
  fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = client.getTopics({});
  await Promise.resolve();
  require("./dataAvailability").markDataPaused();
  finish(response(200, { data: [{ title: "must not render" }] }));
  await expect(pending).rejects.toMatchObject({ dataUnavailable: true });
});

test("healthy old API still returns its original successful payload without browser caching", async () => {
  const client = require("./pulseClient");
  const payload = { data: [], meta: { version: "v1" } };
  fetch.mockResolvedValue(response(200, payload));
  await expect(client.getTopics({})).resolves.toEqual(payload);
  expect(fetch.mock.calls[0][1].cache).toBe("no-store");
});
