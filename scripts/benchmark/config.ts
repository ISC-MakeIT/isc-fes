import { parseInstanceId } from "./identity";

export type Stage = { name: string; connections: number; workflowsPerSecond: number; durationSeconds: number };
export type StoreFixture = { storeId: string; menuId: string; toppingIds: string[]; staffCookieEnv: string; weight: number };
export type Config = {
  label: string;
  instanceType: string;
  targetInstanceId: string;
  backendCommit: string;
  databaseFixture: string;
  baseUrl: string;
  origin: string;
  seed: number;
  httpUsers: number;
  socketsPerGuest: number;
  connectPerSecond: number;
  maxInFlight: number;
  warmupSeconds: number;
  requestTimeoutMs: number;
  notificationTimeoutMs: number;
  thinkTimeMs: number;
  kitchenDelayMs: number;
  kitchenPollingSeconds: number;
  checkoutProbability: number;
  cartProbability: number;
  festivalHours: number;
  stages: Stage[];
  stores: StoreFixture[];
  slo: {
    httpP95Ms: number; httpP99Ms: number; errorRate: number;
    workflowErrorRate: number; notificationP95Ms: number; notificationErrorRate: number;
    wsAvailability: number; droppedRate: number; cpuMaxPercent: number; memoryMaxPercent: number;
    generatorLagP99Ms: number; minSamples: number;
  };
};

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field}: object required`);
  return value as Record<string, unknown>;
}
function str(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field}: nonempty string required`);
  return value;
}
function num(value: unknown, field: string, min: number, max: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${field}: ${integer ? "integer" : "number"} in [${min}, ${max}] required`);
  }
  return value;
}
function url(value: unknown, field: string): string {
  const input = str(value, field);
  const parsed = new URL(input);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new Error(`${field}: HTTP(S) origin without credentials/path/query required`);
  }
  return parsed.origin;
}
function keys(value: Record<string, unknown>, allowed: string[], field: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${field}: unknown key ${key}`);
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value: unknown, field: string): string {
  const result = str(value, field);
  if (!uuid.test(result) || result === "00000000-0000-0000-0000-000000000000") throw new Error(`${field}: nonzero UUID required`);
  return result;
}

export function parseConfig(input: unknown): Config {
  const c = object(input, "config");
  keys(c, ["label", "instanceType", "targetInstanceId", "backendCommit", "databaseFixture", "baseUrl", "origin", "seed", "httpUsers", "socketsPerGuest", "connectPerSecond", "maxInFlight", "warmupSeconds", "requestTimeoutMs", "notificationTimeoutMs", "thinkTimeMs", "kitchenDelayMs", "kitchenPollingSeconds", "checkoutProbability", "cartProbability", "festivalHours", "stages", "stores", "slo"], "config");
  if (!Array.isArray(c.stages) || !c.stages.length || !Array.isArray(c.stores) || !c.stores.length) throw new Error("stages and stores must be nonempty arrays");
  const stages = c.stages.map((v, i) => {
    const s = object(v, `stages[${i}]`);
    keys(s, ["name", "connections", "workflowsPerSecond", "durationSeconds"], "stage");
    return { name: str(s.name, "stage.name"), connections: num(s.connections, "connections", 0, 100_000, true), workflowsPerSecond: num(s.workflowsPerSecond, "workflowsPerSecond", 0, 10_000), durationSeconds: num(s.durationSeconds, "durationSeconds", 1, 86_400, true) };
  });
  if (new Set(stages.map(s => s.name)).size !== stages.length) throw new Error("stage names must be unique");
  const stores = c.stores.map(v => {
    const s = object(v, "store");
    keys(s, ["storeId", "menuId", "toppingIds", "staffCookieEnv", "weight"], "store");
    if (!Array.isArray(s.toppingIds)) throw new Error("toppingIds: array required");
    const staffCookieEnv = str(s.staffCookieEnv, "staffCookieEnv");
    if (!/^[A-Z_][A-Z_0-9]*$/.test(staffCookieEnv)) throw new Error("staffCookieEnv: environment variable name required");
    const toppingIds = s.toppingIds.map(v => id(v, "toppingId"));
    if (new Set(toppingIds).size !== toppingIds.length) throw new Error("duplicate topping IDs");
    return { storeId: id(s.storeId, "storeId"), menuId: id(s.menuId, "menuId"), toppingIds, staffCookieEnv, weight: num(s.weight, "weight", 0.001, 1_000_000) };
  });
  if (new Set(stores.map(s => s.storeId)).size !== stores.length) throw new Error("duplicate store IDs");
  const s = object(c.slo, "slo");
  const slo: Config["slo"] = {
    httpP95Ms: num(s.httpP95Ms, "httpP95Ms", 1, 60_000), httpP99Ms: num(s.httpP99Ms, "httpP99Ms", 1, 60_000),
    errorRate: num(s.errorRate, "errorRate", 0, 1), workflowErrorRate: num(s.workflowErrorRate, "workflowErrorRate", 0, 1),
    notificationP95Ms: num(s.notificationP95Ms, "notificationP95Ms", 1, 60_000), notificationErrorRate: num(s.notificationErrorRate, "notificationErrorRate", 0, 1),
    wsAvailability: num(s.wsAvailability, "wsAvailability", 0, 1), droppedRate: num(s.droppedRate, "droppedRate", 0, 1),
    cpuMaxPercent: num(s.cpuMaxPercent, "cpuMaxPercent", 1, 100), memoryMaxPercent: num(s.memoryMaxPercent, "memoryMaxPercent", 1, 100),
    generatorLagP99Ms: num(s.generatorLagP99Ms, "generatorLagP99Ms", 1, 60_000), minSamples: num(s.minSamples, "minSamples", 1, 1_000_000, true),
  };
  keys(s, Object.keys(slo), "slo");
  const config: Config = {
    label: str(c.label, "label"), instanceType: str(c.instanceType, "instanceType"), baseUrl: url(c.baseUrl, "baseUrl"), origin: url(c.origin, "origin"),
    targetInstanceId: parseInstanceId(c.targetInstanceId),
    backendCommit: str(c.backendCommit, "backendCommit"), databaseFixture: str(c.databaseFixture, "databaseFixture"),
    seed: num(c.seed, "seed", 1, 0xffffffff, true), httpUsers: num(c.httpUsers, "httpUsers", 1, 100_000, true),
    socketsPerGuest: num(c.socketsPerGuest, "socketsPerGuest", 1, 16, true), connectPerSecond: num(c.connectPerSecond, "connectPerSecond", 1, 10_000),
    maxInFlight: num(c.maxInFlight, "maxInFlight", 1, 10_000, true), warmupSeconds: num(c.warmupSeconds, "warmupSeconds", 0, 3600, true),
    requestTimeoutMs: num(c.requestTimeoutMs, "requestTimeoutMs", 100, 120_000, true), notificationTimeoutMs: num(c.notificationTimeoutMs, "notificationTimeoutMs", 100, 120_000, true),
    thinkTimeMs: num(c.thinkTimeMs, "thinkTimeMs", 0, 60_000, true), kitchenDelayMs: num(c.kitchenDelayMs, "kitchenDelayMs", 0, 600_000, true),
    kitchenPollingSeconds: num(c.kitchenPollingSeconds, "kitchenPollingSeconds", 0, 3600),
    cartProbability: num(c.cartProbability, "cartProbability", 0, 1), checkoutProbability: num(c.checkoutProbability, "checkoutProbability", 0, 1),
    festivalHours: num(c.festivalHours, "festivalHours", 1, 48), stages, stores, slo,
  };
  if (config.cartProbability + config.checkoutProbability > 1) throw new Error("cartProbability + checkoutProbability must be <= 1");
  if (stages.some(s => s.connections % config.socketsPerGuest !== 0)) throw new Error("connections must be divisible by socketsPerGuest");
  return config;
}

export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
}

// Fixed arrival times: latency never reduces the offered rate. Late arrivals are dropped, not burst-replayed.
export function dueArrivals(elapsedMs: number, rate: number): number {
  return Math.floor(elapsedMs * rate / 1000);
}

// Arrivals scheduled strictly before the end of a phase. One due exactly at the end belongs to no phase.
export function arrivalsBefore(endMs: number, rate: number): number {
  return Math.max(0, Math.ceil(endMs * rate / 1000) - 1);
}
