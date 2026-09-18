// Run without frontend dependencies: node --experimental-vm-modules --test tests/containment-client.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

async function fixture() {
  const storage = new Map([["pulse:timelapse:v1", "old historical data"]]);
  const calls = [];
  let answer = async () => ({ status: 200, ok: true, json: async () => ({ status: "ok" }) });
  let tokenCalls = 0;
  const context = vm.createContext({
    URL, AbortController, setTimeout, clearTimeout,
    process: { env: { REACT_APP_PULSE_API_BASE: "https://example.test" } },
    localStorage: { removeItem: (key) => storage.delete(key) },
    window: { __PULSE_TIMELAPSE_PROMISE__: Promise.resolve({ data: "stale" }) },
    fetch: (...args) => { calls.push(args); return answer(...args); },
  });
  const read = (file) => fs.readFileSync(path.join(__dirname, "../frontend/src/lib", file), "utf8");
  const state = new vm.SourceTextModule(read("dataAvailability.js"), { context });
  const auth = new vm.SyntheticModule(["getClerkToken"], function () {
    this.setExport("getClerkToken", async () => { tokenCalls++; return null; });
  }, { context });
  const client = new vm.SourceTextModule(read("pulseClient.js"), { context });
  await client.link((name) => name === "./dataAvailability" ? state : auth);
  await client.evaluate();
  return { state: state.namespace, client: client.namespace, storage, calls, context,
    answer: (fn) => { answer = fn; }, tokenCalls: () => tokenCalls };
}
const result = (status, body) => ({ status, ok: status === 200, json: async () => body });
const paused = { error: { code: "data_unavailable", reason: "youtube_containment" } };

test("containment clears browser history cache and blocks subsequent analytics", async () => {
  const f = await fixture();
  let notifications = 0;
  f.state.subscribeDataAvailability(() => notifications++);
  f.answer(async () => result(503, paused));
  await assert.rejects(f.client.getTopics({}), e => e.dataUnavailable === true);
  await assert.rejects(f.client.getMapTimelapse({}), e => e.dataUnavailable === true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.storage.size, 0);
  assert.equal(f.context.window.__PULSE_TIMELAPSE_PROMISE__, null);
  assert.equal(notifications, 1);
});
test("ordinary API errors do not latch containment", async () => {
  const f = await fixture();
  for (const code of [401, 402, 404, 429, 503]) {
    f.answer(async () => result(code, { detail: "ordinary failure" }));
    await assert.rejects(f.client.getTopics({}), e => e.code === code && !e.dataUnavailable);
    assert.equal(f.state.isDataPaused(), false);
  }
});
test("health bypasses identity provider and cannot undo a pause with late data", async () => {
  const f = await fixture();
  f.answer(async () => result(200, { status: "ok", data_available: false }));
  await f.client.getHealth();
  f.answer(async () => result(200, { status: "ok" }));
  await f.client.getHealth();
  assert.equal(f.tokenCalls(), 0);
  assert.equal(f.state.isDataPaused(), true);
});
test("in-flight successful data is discarded after containment", async () => {
  const f = await fixture();
  let finish;
  f.answer(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.client.getTopics({});
  await new Promise(resolve => setImmediate(resolve));
  f.state.markDataPaused();
  finish(result(200, { data: ["must not render"] }));
  await assert.rejects(pending, e => e.dataUnavailable === true);
});
test("healthy payload contract preserved and fetch bypasses HTTP cache", async () => {
  const f = await fixture();
  const payload = { data: [], meta: { version: "v1" } };
  f.answer(async () => result(200, payload));
  assert.equal(await f.client.getTopics({}), payload);
  assert.equal(f.calls[0][1].cache, "no-store");
});
test("cache eviction targets analytical queries, not account or health", async () => {
  const f = await fixture();
  for (const key of ["map", "timelapse", "topics", "topic", "region", "neighbours", "sectors"]) {
    assert.equal(f.state.isAnalyticalQuery({ queryKey: [key] }), true);
  }
  for (const key of ["health", "account"]) {
    assert.equal(f.state.isAnalyticalQuery({ queryKey: [key] }), false);
  }
});
