import { hostname, cpus } from "node:os";
import { Api, cart, list, newGuest, OrderSocket, staffCookie, type Guest } from "./client";
import { random, dueArrivals, type Config, type Stage, type StoreFixture } from "./config";
import { Recorder, type Measurements } from "./stats";
import { pause, workflow } from "./scenario";

export type StageResult = {
  stage: Stage; start: string; end: string; drainedAt: string;
  measurements: Measurements; ramp: Measurements; warmup: Measurements;
};
export type RunResult = {
  schemaVersion: 1; runId: string; sourceFingerprint: string; config: Config;
  start: string; end: string; status: "completed" | "interrupted" | "failed";
  failure: string | null;
  generator: { hostname: string; platform: string; arch: string; bunVersion: string; cpuCount: number; peakRssBytes: number };
  preflight: Measurements; stages: StageResult[];
};

export async function run(c: Config, sourceFingerprint: string, onProgress: (value: unknown) => Promise<void>, onSave: (result: RunResult) => Promise<void>): Promise<RunResult> {
  const abort = new AbortController(), stop = () => abort.abort();
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  const api = new Api(c, abort.signal), rng = random(c.seed), guests: Guest[] = [];
  const preflight = new Recorder("preflight");
  let active = preflight;
  const result: RunResult = {
    schemaVersion: 1, runId: crypto.randomUUID(), sourceFingerprint, config: c,
    start: new Date().toISOString(), end: "", status: "failed", failure: null,
    generator: { hostname: hostname(), platform: process.platform, arch: process.arch, bunVersion: Bun.version, cpuCount: cpus().length, peakRssBytes: process.memoryUsage.rss() },
    preflight: preflight.summary(1, 0), stages: [],
  };
  const inFlight = new Set<Promise<void>>();
  const rampJobs = new Set<Promise<void>>();
  const credentials = new Map<string, string>();
  let connected = 0, cursor = 0, poolSize = 0;
  const socketCount = () => connected;
  const gauge = (delta: number) => { connected += delta; active.gauge(performance.now(), connected); };
  const activate = (r: Recorder) => { active = r; r.beginGauge(performance.now(), socketCount()); };
  const selectStore = (): StoreFixture => {
    let roll = rng() * c.stores.reduce((sum, s) => sum + s.weight, 0);
    for (const store of c.stores) { roll -= store.weight; if (roll < 0) return store; }
    return c.stores[c.stores.length - 1]!;
  };
  const launch = (r: Recorder) => {
    r.scheduled++;
    let guest: Guest | undefined;
    for (let attempt = 0; attempt < Math.min(poolSize, c.maxInFlight + 1); attempt++) {
      const candidate = guests[cursor++ % poolSize];
      if (candidate && !candidate.busy) { guest = candidate; break; }
    }
    if (!guest || inFlight.size >= c.maxInFlight) { r.dropped++; return; }
    guest.busy = true; r.started++;
    const fixture = selectStore(), roll = rng(), jitter = rng();
    const job = workflow(api, c, r, guest, fixture, credentials.get(fixture.storeId) ?? "", roll, jitter, abort.signal)
      .catch(() => { r.workflowFailures++; })
      .finally(() => { r.workflowSettled++; guest.busy = false; inFlight.delete(job); });
    inFlight.add(job);
  };
  const phase = async (r: Recorder, durationSeconds: number, rate: number): Promise<{ start: string; end: string; durationMs: number }> => {
    activate(r);
    const at = performance.now(), start = new Date().toISOString();
    let arrived = 0, previousTick = at, lastProgress = at;
    let previousCpu = process.cpuUsage();
    let nextKitchenPoll = at;
    const polls = new Set<Promise<void>>();
    let window: { start: string; end: string; durationMs: number };
    try {
      while (!abort.signal.aborted) {
        const now = performance.now(), elapsed = now - at;
        r.generatorLag.add(Math.max(0, now - previousTick - 10)); previousTick = now;
        if (elapsed >= durationSeconds * 1000) break;
        const due = dueArrivals(elapsed, rate);
        // Bound each tick's work. Account for missed arrivals when the event loop stalls.
        const skipped = Math.max(0, due - arrived - c.maxInFlight);
        arrived += skipped; r.scheduled += skipped; r.dropped += skipped;
        while (arrived < due) {
          arrived++; r.schedulerLag.add(Math.max(0, elapsed - arrived * 1000 / rate)); launch(r);
        }
        if (c.kitchenPollingSeconds && credentials.size && now >= nextKitchenPoll && !polls.size) {
          nextKitchenPoll = now + c.kitchenPollingSeconds * 1000;
          for (const store of c.stores) {
            const poll = api.request(r, "GET kitchen poll", `/stores/${store.storeId}/orders?statuses=pending&statuses=ready`, { staff: credentials.get(store.storeId), decode: list })
              .then(() => {}, () => {}).finally(() => polls.delete(poll));
            polls.add(poll);
          }
        }
        if (now - lastProgress >= 1000) {
          const cpuDelta = process.cpuUsage(previousCpu), generatorCpuPercent = (cpuDelta.user + cpuDelta.system) / ((now - lastProgress) * 10);
          previousCpu = process.cpuUsage();
          lastProgress = now;
          result.generator.peakRssBytes = Math.max(result.generator.peakRssBytes, process.memoryUsage.rss());
          await onProgress({ at: new Date().toISOString(), phase: r.name, wsReady: socketCount(), inFlight: inFlight.size, scheduled: r.scheduled, dropped: r.dropped, generatorRssBytes: process.memoryUsage.rss(), generatorCpuPercent });
        }
        await pause(10, abort.signal);
      }
    } catch (error) {
      if (!abort.signal.aborted) throw error;
    } finally {
      const durationMs = performance.now() - at;
      // Count the tail of the fixed arrival schedule even if the last timer tick was late.
      const due = dueArrivals(Math.min(durationMs, durationSeconds * 1000), rate);
      r.scheduled += Math.max(0, due - arrived); r.dropped += Math.max(0, due - arrived);
      r.gauge(performance.now(), socketCount());
      const end = new Date().toISOString();
      // Frozen observation window, followed by draining requests attributed to this phase.
      activate(new Recorder("drain"));
      await Promise.all([...inFlight, ...polls]);
      window = { start, end, durationMs };
    }
    return window!;
  };
  try {
    const needsHttp = c.stages.some(s => s.workflowsPerSecond > 0);
    await api.request(preflight, "GET health build", "/health", { decode: v => {
      const health = v as { status?: string; commitHash?: string };
      if (health?.status !== "ok" || health.commitHash !== c.backendCommit) throw new Error("unexpected backend build");
      return health;
    } });
    // All fixture checks precede guest/cart mutations.
    for (const fixture of c.stores) {
      await api.request(preflight, "GET fixture store", `/stores/${fixture.storeId}`, { decode: v => {
        const s = v as { id?: string; closedAt?: string | null; orderEnabled?: boolean };
        if (!s || s.id !== fixture.storeId || (c.checkoutProbability > 0 && (s.closedAt !== null || s.orderEnabled !== true))) throw new Error("fixture store is closed or order disabled");
        return s;
      } });
      if (needsHttp) {
        await api.request(preflight, "GET fixture menus", `/stores/${fixture.storeId}/menus`, { decode: v => {
          if (!list(v).some(item => (item as { id: string; soldOut: boolean }).id === fixture.menuId && (item as { soldOut: boolean }).soldOut === false)) throw new Error("fixture menu unavailable");
          return v;
        } });
        await api.request(preflight, "GET fixture toppings", `/stores/${fixture.storeId}/menus/${fixture.menuId}/toppings`, { decode: v => {
          const ids = list(v).filter(item => (item as { soldOut: boolean }).soldOut === false).map(item => (item as { id: string }).id);
          if (fixture.toppingIds.some(id => !ids.includes(id))) throw new Error("fixture topping unavailable");
          return v;
        } });
      }
      if (needsHttp && (c.checkoutProbability > 0 || c.kitchenPollingSeconds > 0)) {
        const cookie = staffCookie(Bun.env[fixture.staffCookieEnv]);
        credentials.set(fixture.storeId, cookie);
        await api.request(preflight, "GET fixture membership", `/stores/${fixture.storeId}/orders?statuses=pending`, { staff: cookie, decode: list });
      }
    }
    for (const stage of c.stages) {
      if (abort.signal.aborted) break;
      const ramp = new Recorder(`${stage.name}:ramp`), rampAt = performance.now();
      activate(ramp);
      // Retain established connections across increasing stages; close only excess sockets.
      guests.forEach((guest, index) => {
        if (index >= stage.connections / c.socketsPerGuest) { guest.sockets.forEach(s => s.close()); guest.sockets = []; }
      });
      const needed = Math.max(c.httpUsers, stage.connections / c.socketsPerGuest);
      poolSize = needed;
      const pending = rampJobs;
      const createAndConnect = async (index: number) => {
        let guest = guests[index];
        if (!guest) {
          guest = newGuest(); guests.push(guest);
          await api.request(ramp, "PUT bootstrap cart", `/stores/${c.stores[0]!.storeId}/carts`, {
            guest, method: "PUT", body: { expectedVersion: 1, items: [] }, decode: cart,
          });
          if (!guest.cookie) throw new Error("guest session not issued");
        }
        if (index < stage.connections / c.socketsPerGuest) {
          for (let tab = guest.sockets.length; tab < c.socketsPerGuest; tab++) {
            if (abort.signal.aborted) return;
            const socket = new OrderSocket(c, guest, () => active, gauge);
            guest.sockets.push(socket);
            await socket.connect().catch(() => {}); // Failures remain visible in ramp and availability.
          }
        }
      };
      let rampFailure: Error | undefined;
      for (let index = 0; index < needed; index++) {
        if (abort.signal.aborted || rampFailure) break;
        const existing = guests[index];
        if (existing && (index >= stage.connections / c.socketsPerGuest || existing.sockets.length === c.socketsPerGuest)) continue;
        while (pending.size >= c.maxInFlight) await Promise.race(pending);
        const job = createAndConnect(index).catch(() => { rampFailure = new Error("guest bootstrap failed"); }).finally(() => pending.delete(job));
        pending.add(job);
        await pause(1000 * c.socketsPerGuest / c.connectPerSecond, abort.signal);
      }
      await Promise.all(pending);
      if (rampFailure) throw rampFailure;
      ramp.gauge(performance.now(), socketCount());
      const rampSummary = ramp.summary(performance.now() - rampAt, stage.connections);
      const warmup = new Recorder(`${stage.name}:warmup`);
      const warmed = await phase(warmup, c.warmupSeconds, stage.workflowsPerSecond);
      if (abort.signal.aborted) break;
      const measure = new Recorder(stage.name);
      // Insert before measuring: on interruption an incomplete stage is saved and excluded from decisions.
      const entry: StageResult = { stage, start: "", end: "", drainedAt: "", measurements: measure.summary(1, stage.connections), ramp: rampSummary, warmup: warmup.summary(warmed.durationMs || 1, stage.connections) };
      result.stages.push(entry);
      const window = await phase(measure, stage.durationSeconds, stage.workflowsPerSecond);
      Object.assign(entry, { start: window.start, end: window.end, drainedAt: new Date().toISOString(), measurements: measure.summary(window.durationMs || 1, stage.connections) });
      await onSave({ ...result, end: new Date().toISOString(), preflight: preflight.summary(1, 0) });
    }
    result.status = abort.signal.aborted ? "interrupted" : "completed";
  } catch (error) {
    result.status = abort.signal.aborted ? "interrupted" : "failed";
    result.failure = abort.signal.aborted ? "signal received" : error instanceof Error ? error.message : "run failed";
  } finally {
    abort.abort();
    for (const guest of guests) guest.sockets.forEach(socket => socket.close());
    await Promise.all(rampJobs);
    await Promise.all(inFlight);
    process.off("SIGINT", stop); process.off("SIGTERM", stop);
    result.end = new Date().toISOString(); result.preflight = preflight.summary(1, 0);
    result.generator.peakRssBytes = Math.max(result.generator.peakRssBytes, process.memoryUsage.rss());
    await onSave(result);
  }
  return result;
}
