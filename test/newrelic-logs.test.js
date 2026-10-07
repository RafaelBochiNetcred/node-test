const assert = require("node:assert/strict");
const { once } = require("node:events");
const { test } = require("node:test");
const { sendLog } = require("../newrelic-logs");
const app = require("../index");

function configure(t) {
  const originalEnv = { ...process.env };
  t.after(() => {
    process.env = originalEnv;
  });
  process.env.NEW_RELIC_LICENSE_KEY = "test-license-key";
  process.env.NEW_RELIC_APP_NAME = "test-api";
  delete process.env.NEW_RELIC_LOG_API_URL;
}

test("sends an authenticated JSON log to the default API", async (t) => {
  configure(t);
  let request;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    request = { url, ...options };
    return new Response(null, { status: 202 });
  });

  await sendLog({ "http.route": "/api/status", "http.statusCode": 200 });

  assert.equal(request.url, "https://log-api.newrelic.com/log/v1");
  assert.equal(request.method, "POST");
  assert.deepEqual(request.headers, {
    "Content-Type": "application/json",
    "Api-Key": "test-license-key",
  });
  assert.ok(request.signal instanceof AbortSignal);
  const log = JSON.parse(request.body);
  assert.equal(log.message, "Status endpoint responded");
  assert.equal(log.level, "INFO");
  assert.equal(log["service.name"], "test-api");
  assert.equal(log["http.route"], "/api/status");
  assert.equal(log["http.statusCode"], 200);
  assert.ok(Number.isInteger(log.timestamp));
  assert.ok(!request.body.includes("test-license-key"));
});

test("supports a regional API and a default service name", async (t) => {
  configure(t);
  process.env.NEW_RELIC_LOG_API_URL = "https://log-api.eu.newrelic.com/log/v1";
  delete process.env.NEW_RELIC_APP_NAME;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, process.env.NEW_RELIC_LOG_API_URL);
    assert.equal(JSON.parse(options.body)["service.name"], "api");
    return new Response(null, { status: 202 });
  });
  await sendLog({});
});

test("skips delivery without a license key", async (t) => {
  configure(t);
  delete process.env.NEW_RELIC_LICENSE_KEY;
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {});
  await sendLog({});
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("handles rejected HTTP responses without exposing credentials", async (t) => {
  configure(t);
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 403 }));
  const warn = t.mock.method(console, "warn", () => {});
  await sendLog({});
  assert.equal(warn.mock.calls[0].arguments[0], "New Relic log delivery failed (HTTP 403)");
});

test("handles network failures without exposing error details", async (t) => {
  configure(t);
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("sensitive error details");
  });
  const warn = t.mock.method(console, "warn", () => {});
  await assert.doesNotReject(sendLog({}));
  assert.equal(warn.mock.calls[0].arguments[0], "New Relic log delivery failed (network error or timeout)");
});

test("aborts slow log delivery after three seconds", async (t) => {
  configure(t);
  const timeout = t.mock.method(AbortSignal, "timeout", () => AbortSignal.abort());
  t.mock.method(globalThis, "fetch", async (_url, { signal }) => {
    signal.throwIfAborted();
  });
  const warn = t.mock.method(console, "warn", () => {});
  await assert.doesNotReject(sendLog({}));
  assert.equal(timeout.mock.calls[0].arguments[0], 3000);
  assert.equal(warn.mock.callCount(), 1);
});

test("status responds while log delivery is pending and excludes query data", async (t) => {
  configure(t);
  const originalFetch = globalThis.fetch;
  let finishDelivery;
  let log;
  const pendingDelivery = new Promise((resolve) => { finishDelivery = resolve; });
  t.mock.method(globalThis, "fetch", (url, options) => {
    if (url.startsWith("http://127.0.0.1:")) return originalFetch(url, options);
    log = JSON.parse(options.body);
    return pendingDelivery;
  });

  const server = app.listen(0, "127.0.0.1");
  t.after(async () => {
    finishDelivery(new Response(null, { status: 202 }));
    await new Promise((resolve) => server.close(resolve));
  });
  await once(server, "listening");
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/status?token=secret`, {
    signal: AbortSignal.timeout(1000),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "online",
    message: "Welcome to your Node.js API!",
  });
  assert.equal(log["http.method"], "GET");
  assert.equal(log["http.route"], "/api/status");
  assert.equal(log["http.statusCode"], 200);
  assert.ok(log["duration.ms"] >= 0);
  assert.ok(!JSON.stringify(log).includes("secret"));
});
