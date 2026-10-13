import { describe, test, expect } from "bun:test";
import mixed from "../mixed.example.json";
import ws from "../ws.example.json";
import { parseConfig, random, dueArrivals } from "../config";
import { Histogram, Recorder } from "../stats";
import { parseCpu, cpuDelta, parseMemory, parseNetwork, networkDelta, parseDisks, diskDelta, parseMachineSamples, parseCredits, creditProjection, summarizeMachine, type MachineSample } from "../metrics";
import { evaluate, buildReport, compareReports } from "../report";
import { run, type StageResult, type RunResult } from "../runner";
import { Api, guestCookie, newGuest, staffCookie, cart, changedOrders, OrderSocket, type Fetcher } from "../client";
import { workflow } from "../scenario";
import { main } from "../index";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const config = parseConfig(mixed);
const from = "2026-10-13T00:00:00.000Z", to = "2026-10-13T00:05:00.000Z";
function sample(at: string, intervalSeconds = 5): MachineSample {
  return { schemaVersion: 1, at, intervalSeconds, label: config.label, instanceType: config.instanceType, hostname: "target",
    cpuPercent: 30, ioWaitPercent: 2, stealPercent: 0, memoryPercent: 40, memoryAvailableBytes: 1200, memoryTotalBytes: 2000, swapUsedBytes: 0,
    load1: 0.5, openFiles: 100, pressure: { cpu: 0, memory: 0, io: 0 }, network: {}, disks: {}, containers: [], dockerError: false };
}
function goodStage(): StageResult {
  const r = new Recorder("mixed-1000");
  r.started = 100; r.scheduled = 100; r.workflowSettled = 100;
  r.beginGauge(0, 1000); r.gauge(300_000, 1000); r.generatorLag.add(1);
  for (let i = 0; i < 100; i++) {
    r.record("GET stores", 50, true, "200"); r.record("POST order", 100, true, "201");
    r.record("PATCH order.ready", 50, true, "200"); r.record("PATCH order.completed", 50, true, "200"); r.record("ws.notification", 100, true, "received");
    for (const name of ["GET store", "GET menus", "GET toppings", "GET orders", "GET rooms", "GET allergens", "GET cart", "PUT cart.add", "PUT cart.quantity", "PUT cart.remove", "GET order", "GET kitchen orders", "GET kitchen poll"]) r.record(name, 50, true, "200");
  }
  const ramp = new Recorder("ramp"); ramp.beginGauge(0, 0); ramp.record("ws.ready", 10, true, "ready");
  return { stage: { name: "mixed-1000", connections: 1000, workflowsPerSecond: 40, durationSeconds: 300 }, start: from, end: to, drainedAt: to,
    measurements: r.summary(300_000, 1000), ramp: ramp.summary(1, 1000), warmup: ramp.summary(1, 1000) };
}
const samples = Array.from({ length: 60 }, (_, i) => sample(new Date(Date.parse(from) + (i + 1) * 5000).toISOString()));
const credits = [{ at: from, balance: 500 }, { at: to, balance: 490 }];
function runResult(): RunResult {
  return { schemaVersion: 1, runId: "test-run", sourceFingerprint: "same-source", config, start: from, end: to, status: "completed", failure: null,
    generator: { hostname: "generator", platform: "darwin", arch: "arm64", bunVersion: "test", cpuCount: 4, peakRssBytes: 1000 },
    preflight: goodStage().ramp, stages: [goodStage()] };
}

describe("configuration and schedule", () => {
  test("both checked-in plans are valid, URLs contain no deployed environment", () => {
    expect(parseConfig(ws).stages.every(s => s.workflowsPerSecond === 0)).toBe(true);
    expect(config.baseUrl).toEndWith(".invalid");
  });
  test("rejects typo, invalid mixture, fanout mismatch and unsafe URL", () => {
    expect(() => parseConfig({ ...mixed, unexpected: true })).toThrow("unknown key");
    expect(() => parseConfig({ ...mixed, cartProbability: .9, checkoutProbability: .9 })).toThrow();
    expect(() => parseConfig({ ...mixed, socketsPerGuest: 3 })).toThrow("divisible");
    expect(() => parseConfig({ ...mixed, baseUrl: "https://user:password@host" })).toThrow();
    expect(() => parseConfig({ ...mixed, baseUrl: "https://host/api" })).toThrow();
    expect(() => parseConfig({ ...mixed, seed: 0 })).toThrow();
  });
  test("arrival counts are independent of response times and fractional rates work", () => {
    expect(dueArrivals(0, 20)).toBe(0);
    expect(dueArrivals(5000, 20)).toBe(100);
    expect(dueArrivals(10000, .5)).toBe(5);
    const a = random(123), b = random(123);
    expect(Array.from({ length: 20 }, a)).toEqual(Array.from({ length: 20 }, b));
  });
});
describe("bounded statistics", () => {
  test("empty quantiles are missing, upper-bound quantiles preserve tail failures", () => {
    const h = new Histogram(); expect(h.percentile(.99)).toBeNull();
    for (let i = 1; i <= 100; i++) h.add(i);
    expect(h.percentile(.95)!).toBeGreaterThanOrEqual(95);
    expect(h.percentile(.95)!).toBeLessThanOrEqual(95 * 1.02);
    expect(h.summary().maxMs).toBe(100);
    expect(() => h.add(NaN)).toThrow();
    const r = new Recorder("failure"); r.record("GET", 10000, false, "timeout");
    expect(r.operations.get("GET")!.summary().successLatency.count).toBe(0);
    expect(r.operations.get("GET")!.summary().p99Ms).toBe(10000);
  });
  test("WS availability is time weighted, not a sampled endpoint snapshot", () => {
    const r = new Recorder("ws"); r.beginGauge(0, 100); r.gauge(1000, 50); r.gauge(2000, 50);
    expect(r.summary(2000, 100).ws.availability).toBe(.75);
    expect(r.summary(2000, 100).ws.min).toBe(50);
  });
});
describe("target metrics and credits", () => {
  test("excludes guest CPU double counting and keeps iowait/steal visible", () => {
    expect(parseCpu("cpu 10 20 30 40 5 6 7 8 100 200\n").total).toBe(126);
    const measured = cpuDelta({ total: 100, idle: 50, iowait: 0, steal: 0 }, { total: 200, idle: 100, iowait: 10, steal: 5 });
    expect(measured).toEqual({ cpuPercent: 40, ioWaitPercent: 10, stealPercent: 5 });
    expect(() => cpuDelta(parseCpu("cpu 1 1 1 1 1 1 1 1"), parseCpu("cpu 1 1 1 1 1 1 1 1"))).toThrow();
    expect(parseMemory("MemTotal: 1000 kB\nMemAvailable: 600 kB\nSwapTotal: 100 kB\nSwapFree: 50 kB")).toMatchObject({ memoryPercent: 40, swapUsedBytes: 51200 });
  });
  test("network and disks use actual elapsed intervals and sector bytes", () => {
    const before = parseNetwork("eth0: 100 0 0 0 0 0 0 0 200 0 0 0 0 0 0 0");
    const after = parseNetwork("eth0: 300 0 0 0 0 0 0 0 600 0 0 0 0 0 0 0");
    expect(networkDelta(before, after, 2).eth0).toEqual({ rxBytesPerSecond: 100, txBytesPerSecond: 200 });
    const disks = parseDisks("259 0 nvme0n1 10 0 20 0 30 0 40 0 2 100 0");
    expect(disks.nvme0n1!.readBytes).toBe(10240);
    expect(diskDelta(disks, disks, 5).nvme0n1!.readIops).toBe(0);
  });
  test("joins target time windows, rejects another run/host, gaps stay visible", () => {
    const summary = summarizeMachine(samples, from, to);
    expect(summary.coverage).toBe(1); expect(summary.cpuMeanPercent).toBe(30);
    expect(summarizeMachine(samples.slice(30), from, to).coverage).toBe(.5);
    const text = samples.map(s => JSON.stringify(s)).join("\n");
    expect(parseMachineSamples(text, config.label, config.instanceType)).toHaveLength(60);
    expect(() => parseMachineSamples(text, "different", config.instanceType)).toThrow();
    expect(() => parseMachineSamples(JSON.stringify({ ...sample(to), cpuPercent: null }), config.label, config.instanceType)).toThrow();
  });
  test("CPU projection requires bracketing points and rejects partial CloudWatch results", () => {
    expect(creditProjection("t4g.small", 8, 30, credits, from, to)).toMatchObject({ drainPerHour: 12, requiredCredits: 120, sufficient: true });
    expect(creditProjection("t4g.medium", 8, 30, credits, from, to)?.drainPerHour).toBe(12);
    expect(creditProjection("t4g.small", 8, 70, [{ at: from, balance: 10 }, { at: to, balance: 5 }], from, to)?.sufficient).toBe(false);
    expect(creditProjection("t4g.small", 8, 30, credits.slice(1), from, to)).toBeNull();
    expect(creditProjection("t4g.small", 8, 30, [], from, to)).toBeNull();
    expect(creditProjection("t4g.small", 8, 10, [{ at: from, balance: 0 }, { at: to, balance: 0 }], from, to)?.sufficient).toBe(true);
    expect(() => parseCredits({ MetricDataResults: [{ Id: "creditbalance", StatusCode: "PartialData", Timestamps: [], Values: [] }] })).toThrow();
    expect(parseCredits({ MetricDataResults: [{ Id: "creditbalance", StatusCode: "Complete", Timestamps: [to, from], Values: [490, 500] }] })).toEqual(credits);
  });
  test("missing five-minute credit points cannot produce a passing report", () => {
    const end = "2026-10-13T00:15:00.000Z";
    const complete = Array.from({ length: 4 }, (_, i) => ({ at: new Date(Date.parse(from) + i * 300_000).toISOString(), balance: 500 }));
    expect(creditProjection("t4g.small", 8, 30, complete.toReversed(), from, end)?.sufficient).toBe(true);
    const missing = [complete[0]!, complete[3]!];
    expect(creditProjection("t4g.small", 8, 30, missing, from, end)).toBeNull();
    expect(creditProjection("t4g.small", 8, 30, complete.filter((_, i) => i !== 1), from, end)).toBeNull();
    const entry = goodStage();
    entry.end = end; entry.stage.durationSeconds = 900; entry.measurements.durationMs = 900_000;
    const run = { ...runResult(), end, stages: [entry] };
    const fullSamples = Array.from({ length: 180 }, (_, i) => sample(new Date(Date.parse(from) + (i + 1) * 5000).toISOString()));
    expect(buildReport(run, fullSamples, complete).stages[0]!.gate.status).toBe("pass");
    expect(buildReport(run, fullSamples, missing).stages[0]!.gate.status).toBe("inconclusive");
  });
});

test("offline report CLI writes reviewable JSON/Markdown and refuses mismatched credit metadata", async () => {
  const dir = await mkdtemp(join(tmpdir(), "isc-fes-benchmark-test-"));
  try {
    const resultPath = join(dir, "result.json"), metricsPath = join(dir, "metrics.jsonl"), creditsPath = join(dir, "credits.json");
    await writeFile(resultPath, JSON.stringify(runResult()));
    await writeFile(metricsPath, samples.map(s => JSON.stringify(s)).join("\n"));
    const creditInput = { label: config.label, instanceType: config.instanceType, instanceId: "i-test", creditsMode: "standard", cloudWatch: { MetricDataResults: [{ Id: "creditbalance", StatusCode: "Complete", Timestamps: credits.map(p => p.at), Values: credits.map(p => p.balance) }] } };
    await writeFile(creditsPath, JSON.stringify(creditInput));
    await main(["report", "--result", resultPath, "--metrics", metricsPath, "--credits", creditsPath, "--out", join(dir, "report")]);
    expect((await Bun.file(join(dir, "report/report.json")).json()).stages[0].gate.status).toBe("pass");
    expect(await Bun.file(join(dir, "report/report.md")).text()).toContain("POST order");
    await writeFile(creditsPath, JSON.stringify({ ...creditInput, label: "other" }));
    await expect(main(["report", "--result", resultPath, "--credits", creditsPath, "--out", join(dir, "bad")])).rejects.toThrow("Mismatched credits metadata");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
describe("SLO and sizing decisions", () => {
  const machine = summarizeMachine(samples, from, to);
  const projection = creditProjection(config.instanceType, 8, machine.cpuMeanPercent, credits, from, to);
  test("passes full evidence, missing metrics/credits never pass", () => {
    expect(evaluate(config, goodStage(), machine, projection).status).toBe("pass");
    expect(evaluate(config, goodStage(), summarizeMachine([], from, to), null).status).toBe("inconclusive");
  });
  test("checks per-operation tails, notifications, drops and generator bottlenecks", () => {
    const entry = goodStage(); entry.measurements.operations["POST order"]!.p99Ms = 9000;
    expect(evaluate(config, entry, machine, projection).status).toBe("fail");
    entry.measurements.generatorLag.p99Ms = 1000;
    expect(evaluate(config, entry, machine, projection).status).toBe("inconclusive");
    const loss = goodStage(); loss.measurements.operations["ws.notification"]!.errorRate = .5;
    expect(evaluate(config, loss, machine, projection).status).toBe("fail");
    const drops = goodStage(); drops.measurements.droppedRate = .5;
    expect(evaluate(config, drops, machine, projection).status).toBe("fail");
  });
  test("does not recommend an untested size/load, incompatible reports or interrupted runs", () => {
    const small = buildReport(runResult(), samples, credits);
    const medium = { ...small, instanceType: "t4g.medium", config: { ...small.config, instanceType: "t4g.medium", label: "medium-1" } };
    expect(compareReports(small, medium, 1000, 40).recommendation).toBe("t4g.small");
    expect(compareReports(small, medium, 2000, 80).recommendation).toBe("inconclusive");
    expect(compareReports({ ...small, runStatus: "interrupted" }, { ...medium, runStatus: "interrupted" }, 1000, 40).recommendation).toBe("inconclusive");
    expect(() => compareReports(small, { ...medium, sourceFingerprint: "other-source" }, 1000, 40)).toThrow();
    expect(() => compareReports(small, { ...medium, config: { ...medium.config, seed: 42 } }, 1000, 40)).toThrow();
    for (const generator of [
      { ...medium.generator, hostname: "another-generator" },
      { ...medium.generator, bunVersion: "another-version" },
      { ...medium.generator, platform: "linux" },
      { ...medium.generator, arch: "x64" },
      { ...medium.generator, cpuCount: 8 },
    ]) expect(() => compareReports(small, { ...medium, generator }, 1000, 40)).toThrow("Generator");
    expect(buildReport(runResult()).highestPassingConnections).toBe(0);
  });
});
describe("HTTP isolation and offline checkout workflow", () => {
  test("cookies rotate per guest; staff cookie never includes visitor cookie", () => {
    const h = new Headers(); h.append("Set-Cookie", "other=ignore"); h.append("Set-Cookie", "isc_fes_guest_session=rotated; HttpOnly; Path=/");
    expect(guestCookie(h, "isc_fes_guest_session=previous")).toBe("isc_fes_guest_session=rotated");
    expect(() => staffCookie("isc_fes_account_session=token; isc_fes_guest_session=guest")).toThrow();
    expect(() => staffCookie("isc_fes_account_session=x\nsecret")).toThrow();
  });
  test("consumes complete body, records bad bodies and sanitizes errors", async () => {
    const guest = newGuest(), r = new Recorder("HTTP");
    const api = new Api(config, new AbortController().signal, (async (_url, options) => {
      expect(options!.redirect).toBe("error");
      return new Response('{"version":1,"canCheckout":false,"items":[]}', { headers: { "Set-Cookie": "isc_fes_guest_session=one; Path=/" } });
    }) as Fetcher);
    await api.request(r, "GET cart", "/cart", { guest, decode: cart });
    expect(guest.cookie).toBe("isc_fes_guest_session=one");
    expect(r.operations.get("GET cart")!.bytes).toBeGreaterThan(0);
    const failing = new Api(config, new AbortController().signal, (async () => new Response("secret-token", { status: 409 })) as Fetcher);
    await expect(failing.request(r, "PUT cart", "/cart", { decode: cart })).rejects.toThrow("PUT cart failed (409)");
    expect(r.operations.get("PUT cart")!.summary().failures).toBe(1);
    const bad = new Api(config, new AbortController().signal, (async () => new Response('{}')) as Fetcher);
    await expect(bad.request(r, "GET cart", "/cart", { decode: cart })).rejects.toThrow("invalid_body");
  });
  test("uses live cart/order versions and completes pending -> ready -> completed without any network", async () => {
    const fixture = config.stores[0]!, guest = newGuest(), r = new Recorder("workflow");
    guest.cookie = "isc_fes_guest_session=visitor";
    const calls: { path: string; method: string; body: Record<string, unknown> | undefined; cookie: string | null }[] = [];
    const fake = (async (input, options) => {
      const path = new URL(String(input)).pathname, method = options?.method ?? "GET";
      const body = options?.body ? JSON.parse(String(options.body)) : undefined;
      calls.push({ path, method, body, cookie: new Headers(options?.headers).get("Cookie") });
      let response: unknown = { data: [] };
      if (path === `/stores/${fixture.storeId}`) response = { id: fixture.storeId };
      if (path.endsWith("/carts")) {
        const version = body ? Number(body.expectedVersion) + 1 : 7;
        response = { version, canCheckout: true, items: body?.items?.length === 0 ? [] : [{ id: "item", menuId: fixture.menuId, quantity: 1, toppings: [] }] };
      }
      if (path === "/orders" && method === "POST") response = { id: "created", version: 1, status: "pending" };
      if (path === "/orders/created") response = { id: "created", version: 1, status: "pending" };
      if (method === "PATCH") response = { id: "created", version: Number(body.expectedVersion) + 1, status: body.status };
      return Response.json(response, { status: method === "POST" ? 201 : 200 });
    }) as Fetcher;
    await workflow(new Api(config, new AbortController().signal, fake), { ...config, thinkTimeMs: 0, kitchenDelayMs: 0 }, r, guest, fixture, "isc_fes_account_session=staff", 0, .5, new AbortController().signal);
    const updates = calls.filter(c => c.method === "PUT");
    expect(updates.map(c => c.body?.expectedVersion)).toEqual([7, 8]);
    expect((updates[1]!.body!.items as { id: string }[])[0]!.id).toBe("item");
    expect(calls.find(c => c.method === "POST")!.body).toEqual({ storeId: fixture.storeId, expectedCartVersion: 9 });
    expect(calls.filter(c => c.method === "PATCH").map(c => c.body)).toEqual([{ expectedVersion: 1, status: "ready" }, { expectedVersion: 2, status: "completed" }]);
    expect(calls.filter(c => c.method === "PATCH").every(c => c.cookie === "isc_fes_account_session=staff")).toBe(true);
    expect(changedOrders({ type: "orders.changed", data: { changedOrderId: "created", orders: [{ id: "created", version: 2, status: "ready" }] } }).orders[0]!.version).toBe(2);
  });
});

describe("WS recovery between stages without a server", () => {
  for (const failure of ["connect", "close"] as const) {
    test(`replaces ${failure} failures on the next ramp, retains healthy tabs and closes excess guests`, async () => {
      const c = parseConfig({ ...ws, socketsPerGuest: 2, connectPerSecond: 10_000, warmupSeconds: 0,
        stages: [2, 4, 2].map((connections, i) => ({ name: `stage-${i}`, connections, workflowsPerSecond: 0, durationSeconds: 1 })) });
      let attempts = 0, terminated = 0;
      const closed = new Set<number>();
      const fetcher: Fetcher = async input => {
        const path = new URL(String(input)).pathname;
        if (path === "/health") return Response.json({ status: "ok", commitHash: c.backendCommit });
        if (path.endsWith("/carts")) return Response.json({ version: 1, canCheckout: false, items: [] }, { headers: { "Set-Cookie": "isc_fes_guest_session=test" } });
        return Response.json({ id: c.stores[0]!.storeId });
      };
      const result = await run(c, "test", async () => {}, async saved => {
        if (saved.stages.length === 2) expect([...closed].sort()).toEqual(failure === "connect" ? [] : [1]);
        if (saved.stages.length === 3 && saved.status !== "completed") expect(closed.has(4) && closed.has(5)).toBe(true);
      }, { fetcher, socketFactory: () => {
        const attempt = ++attempts;
        if (attempt === 1 && failure === "connect") throw new Error("temporary connection failure");
        const socket = {
          onmessage: null as ((event: MessageEvent) => void) | null,
          onerror: null as ((event: Event) => void) | null,
          onclose: null as ((event: CloseEvent) => void) | null,
          terminate: () => { terminated++; closed.add(attempt); },
        };
        queueMicrotask(() => socket.onmessage?.(new MessageEvent("message", { data: JSON.stringify({ type: "connection.ready", data: { orders: [] } }) })));
        if (attempt === 1 && failure === "close") setTimeout(() => socket.onclose?.({ code: 1013 } as CloseEvent), 100);
        return socket;
      } });
      expect(result.status).toBe("completed");
      expect(attempts).toBe(5);
      expect(terminated).toBe(failure === "connect" ? 4 : 5);
      expect(result.stages[0]!.measurements.ws.availability).toBeLessThan(1);
      if (failure === "connect") expect(result.stages[0]!.ramp.operations["ws.ready"]!.failures).toBe(1);
      else expect(result.stages[0]!.measurements.ws.unexpectedCloses["1013"]).toBe(1);
      expect(result.stages[1]!.ramp.operations["ws.ready"]!.count).toBe(3);
      expect(result.stages[1]!.measurements.ws.availability).toBeCloseTo(1, 3);
      expect(result.stages[2]!.measurements.ws.availability).toBeCloseTo(1, 3);
    });
  }
});

describe("WS protocol without a server", () => {
  function setup() {
    const r = new Recorder("ws"), guest = newGuest(); guest.cookie = "isc_fes_guest_session=visitor";
    let active = 0, terminated = 0;
    const transport = {
      onmessage: null as ((event: MessageEvent) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      onclose: null as ((event: CloseEvent) => void) | null,
      terminate: () => { terminated++; },
    };
    const socket = new OrderSocket({ ...config, requestTimeoutMs: 100, notificationTimeoutMs: 100 }, guest, () => r, delta => { active += delta; }, (url, options) => {
      expect(url.protocol).toBe("wss:");
      expect(options.headers?.Origin).toBe(config.origin);
      expect(options.headers?.Cookie).toBe(guest.cookie);
      return transport;
    });
    const emit = (value: unknown) => transport.onmessage?.(new MessageEvent("message", { data: JSON.stringify(value) }));
    return { r, socket, transport, emit, active: () => active, terminated: () => terminated };
  }
  test("readiness requires initial sync; early notifications match exact order/version/status", async () => {
    const s = setup(), connecting = s.socket.connect();
    expect(s.socket.ready).toBe(false);
    s.emit({ type: "connection.ready", data: { orders: [] } }); await connecting;
    expect(s.active()).toBe(1);
    const waiting = s.socket.expect(s.r, "created", 2, "ready");
    s.emit({ type: "orders.changed", data: { changedOrderId: "created", orders: [{ id: "created", version: 1, status: "pending" }] } });
    expect(s.r.operations.get("ws.notification")).toBeUndefined();
    s.emit({ type: "orders.changed", data: { changedOrderId: "created", orders: [{ id: "created", version: 2, status: "ready" }] } });
    expect(await waiting.done).toBe(true);
    s.socket.close(); expect(s.active()).toBe(0); expect(s.terminated()).toBe(1);
  });
  test("timeouts and unexpected close codes are counted; canceled waiters resolve", async () => {
    const s = setup(), connecting = s.socket.connect();
    s.emit({ type: "connection.ready", data: { orders: [] } }); await connecting;
    const lost = s.socket.expect(s.r, "created", 2, "ready");
    expect(await lost.done).toBe(false);
    expect(s.r.operations.get("ws.notification")!.statuses.timeout).toBe(1);
    const canceled = s.socket.expect(s.r, "created", 3, "completed"); canceled.cancel();
    expect(await canceled.done).toBe(false);
    s.transport.onclose?.({ code: 1013 } as CloseEvent);
    expect(s.r.wsUnexpectedCloses["1013"]).toBe(1); expect(s.active()).toBe(0);
    s.socket.close();
  });
  test("invalid initial data fails and terminates instead of counting an open socket", async () => {
    const s = setup(), connecting = s.socket.connect();
    s.emit({ type: "orders.changed", data: { orders: [] } });
    await expect(connecting).rejects.toThrow("protocol_error");
    expect(s.r.wsProtocolErrors).toBe(1); expect(s.socket.ready).toBe(false); expect(s.terminated()).toBe(1);
  });
  test("stopping during initial sync settles immediately without waiting for its timeout", async () => {
    const s = setup(), connecting = s.socket.connect();
    s.socket.close();
    await expect(connecting).rejects.toThrow("client_stopped");
    expect(s.r.operations.get("ws.ready")!.statuses.client_stopped).toBe(1);
    expect(s.terminated()).toBe(1);
  });
});
