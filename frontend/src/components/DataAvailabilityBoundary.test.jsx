import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DataAvailabilityBoundary } from "./DataAvailabilityBoundary";

let mockHealth;
jest.mock("../lib/queries", () => ({ useHealth: () => mockHealth }));
jest.mock("./AppShell", () => ({
  AppShell: ({ children }) => <div><nav>Navigation and sign in</nav>{children}</div>,
}));
let node, root, client;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockHealth = { data: { status: "ok" }, isPending: false, isError: false };
  node = document.createElement("div");
  document.body.appendChild(node);
  root = createRoot(node);
  client = new QueryClient();
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  client.clear();
});
async function render(path = "/") {
  await act(async () => {
    root.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>
      <DataAvailabilityBoundary><div data-testid="analytics">Live data surface</div></DataAvailabilityBoundary>
    </MemoryRouter></QueryClientProvider>);
  });
}
test("healthy legacy API preserves normal pages", async () => {
  await render();
  expect(node.querySelector('[data-testid="analytics"]')).not.toBeNull();
});
test("initial health check and connection error never mount data surfaces", async () => {
  mockHealth = { isPending: true };
  await render();
  expect(node.textContent).toContain("Checking data availability");
  expect(node.querySelector('[data-testid="analytics"]')).toBeNull();
  mockHealth = { isError: true };
  await render();
  expect(node.textContent).toContain("couldn't connect");
});
test("pause clears analytical cache, preserves other cache and handles historical links", async () => {
  client.setQueryData(["timelapse"], { data: "old" });
  client.setQueryData(["account"], { signedIn: true });
  mockHealth = { data: { status: "ok", data_available: false } };
  await render("/topic/123?history_hours=720");
  expect(node.textContent).toContain("Live and historical data are temporarily unavailable");
  expect(node.textContent).toContain("Navigation and sign in");
  expect(node.querySelector('[data-testid="analytics"]')).toBeNull();
  expect(client.getQueryData(["timelapse"])).toBeUndefined();
  expect(client.getQueryData(["account"])).toEqual({ signedIn: true });
});
test("account route remains mounted during containment", async () => {
  mockHealth = { data: { status: "ok", data_available: false } };
  await render("/upgrade");
  expect(node.querySelector('[data-testid="analytics"]')).not.toBeNull();
});
