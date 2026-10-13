export type Cpu = { total: number; idle: number; iowait: number; steal: number };
export function parseCpu(text: string): Cpu {
  const fields = text.split("\n")[0]!.trim().split(/\s+/);
  if (fields[0] !== "cpu") throw new Error("invalid /proc/stat");
  const values = fields.slice(1, 9).map(Number); // guest times are already included in user/nice.
  if (values.length < 8 || values.some(n => !Number.isFinite(n))) throw new Error("invalid CPU counters");
  return { total: values.reduce((a, b) => a + b, 0), idle: values[3]!, iowait: values[4]!, steal: values[7]! };
}
export function cpuDelta(before: Cpu, after: Cpu): { cpuPercent: number; ioWaitPercent: number; stealPercent: number } {
  const total = after.total - before.total;
  if (total <= 0) throw new Error("non-increasing CPU counter");
  return { cpuPercent: 100 * (total - (after.idle - before.idle) - (after.iowait - before.iowait)) / total,
    ioWaitPercent: 100 * (after.iowait - before.iowait) / total, stealPercent: 100 * (after.steal - before.steal) / total };
}
export function parseMemory(text: string): { memoryPercent: number; memoryTotalBytes: number; memoryAvailableBytes: number; swapUsedBytes: number } {
  const fields = Object.fromEntries(text.trim().split("\n").map(line => { const [key, n] = line.split(/:\s*/); return [key, Number(n?.split(/\s+/)[0]) * 1024]; }));
  const total = fields.MemTotal!, available = fields.MemAvailable!;
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(available) || available < 0 || available > total || !Number.isFinite(fields.SwapTotal) || !Number.isFinite(fields.SwapFree)) throw new Error("invalid /proc/meminfo");
  return { memoryPercent: 100 * (total - available) / total, memoryTotalBytes: total, memoryAvailableBytes: available, swapUsedBytes: fields.SwapTotal! - fields.SwapFree! };
}
export type NetCounters = Record<string, { rxBytes: number; txBytes: number }>;
export function parseNetwork(text: string): NetCounters {
  return Object.fromEntries(text.split("\n").filter(line => line.includes(":" )).map(line => {
    const [name, rest] = line.split(":"), fields = rest!.trim().split(/\s+/).map(Number);
    return [name!.trim(), { rxBytes: fields[0]!, txBytes: fields[8]! }];
  }));
}
export type DiskCounters = Record<string, { reads: number; writes: number; readBytes: number; writeBytes: number; busyMs: number; inFlight: number }>;
export function parseDisks(text: string): DiskCounters {
  return Object.fromEntries(text.trim().split("\n").filter(Boolean).map(line => {
    const f = line.trim().split(/\s+/);
    return [f[2]!, { reads: Number(f[3]), writes: Number(f[7]), readBytes: Number(f[5]) * 512, writeBytes: Number(f[9]) * 512, busyMs: Number(f[12]), inFlight: Number(f[11]) }];
  }));
}
export function parsePressure(text: string): number | null {
  const value = text.match(/^some avg10=([\d.]+)/m)?.[1];
  return value === undefined ? null : Number(value);
}
export function networkDelta(before: NetCounters, after: NetCounters, seconds: number) {
  return Object.fromEntries(Object.entries(after).filter(([name]) => before[name]).map(([name, value]) => [name, {
    rxBytesPerSecond: Math.max(0, value.rxBytes - before[name]!.rxBytes) / seconds,
    txBytesPerSecond: Math.max(0, value.txBytes - before[name]!.txBytes) / seconds,
  }]));
}
export function diskDelta(before: DiskCounters, after: DiskCounters, seconds: number) {
  return Object.fromEntries(Object.entries(after).filter(([name]) => before[name]).map(([name, value]) => [name, {
    readIops: Math.max(0, value.reads - before[name]!.reads) / seconds, writeIops: Math.max(0, value.writes - before[name]!.writes) / seconds,
    readBytesPerSecond: Math.max(0, value.readBytes - before[name]!.readBytes) / seconds, writeBytesPerSecond: Math.max(0, value.writeBytes - before[name]!.writeBytes) / seconds,
    busyPercent: Math.max(0, value.busyMs - before[name]!.busyMs) / (seconds * 10), inFlight: value.inFlight,
  }]));
}
export type MachineSample = {
  schemaVersion: 1; at: string; intervalSeconds: number; label: string; instanceType: string; hostname: string;
  cpuPercent: number; ioWaitPercent: number; stealPercent: number;
  memoryPercent: number; memoryTotalBytes: number; memoryAvailableBytes: number; swapUsedBytes: number;
  load1: number; openFiles: number | null;
  pressure: { cpu: number | null; memory: number | null; io: number | null };
  network: ReturnType<typeof networkDelta>; disks: ReturnType<typeof diskDelta>;
  containers: unknown[] | null; dockerError: boolean;
};
export type MachineSummary = {
  count: number; coverage: number; maxGapSeconds: number; cpuMeanPercent: number | null; cpuMaxPercent: number | null;
  memoryMaxPercent: number | null; swapMaxBytes: number | null; ioWaitMaxPercent: number | null;
  stealMaxPercent: number | null; ioPressureMax: number | null; dockerErrors: number;
};
export function summarizeMachine(samples: MachineSample[], start: string, end: string): MachineSummary {
  const startMs = Date.parse(start), endMs = Date.parse(end);
  // A sample describes the preceding interval. Require it to be fully inside the measurement window.
  const selected = samples.filter(s => Date.parse(s.at) <= endMs && Date.parse(s.at) - s.intervalSeconds * 1000 >= startMs).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const max = (values: number[]): number | null => values.length ? values.reduce((a, b) => Math.max(a, b)) : null;
  let covered = 0, cursor = startMs, maxGap = 0;
  for (const s of selected) {
    const at = Date.parse(s.at), from = at - s.intervalSeconds * 1000;
    maxGap = Math.max(maxGap, from - cursor);
    covered += Math.max(0, at - Math.max(cursor, from)); cursor = Math.max(cursor, at);
  }
  maxGap = Math.max(maxGap, endMs - cursor);
  const seconds = selected.reduce((sum, s) => sum + s.intervalSeconds, 0);
  return {
    count: selected.length, coverage: endMs > startMs ? covered / (endMs - startMs) : 0, maxGapSeconds: maxGap / 1000,
    cpuMeanPercent: seconds ? selected.reduce((sum, s) => sum + s.cpuPercent * s.intervalSeconds, 0) / seconds : null,
    cpuMaxPercent: max(selected.map(s => s.cpuPercent)), memoryMaxPercent: max(selected.map(s => s.memoryPercent)),
    swapMaxBytes: max(selected.map(s => s.swapUsedBytes)), ioWaitMaxPercent: max(selected.map(s => s.ioWaitPercent)),
    stealMaxPercent: max(selected.map(s => s.stealPercent)), ioPressureMax: max(selected.flatMap(s => s.pressure.io === null ? [] : [s.pressure.io])),
    dockerErrors: selected.filter(s => s.dockerError).length,
  };
}

export function parseMachineSamples(text: string, label: string, instanceType: string): MachineSample[] {
  const rows = text.split("\n").filter(line => line.trim()).map(line => JSON.parse(line) as MachineSample);
  const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  for (const row of rows) {
    if (row.schemaVersion !== 1 || row.label !== label || row.instanceType !== instanceType || typeof row.hostname !== "string" || !Number.isFinite(Date.parse(row.at)) || !finite(row.intervalSeconds) || row.intervalSeconds <= 0 || !row.pressure || !finite(row.cpuPercent) || row.cpuPercent < 0 || row.cpuPercent > 100 || !finite(row.memoryPercent) || row.memoryPercent < 0 || row.memoryPercent > 100 || !finite(row.swapUsedBytes) || !finite(row.ioWaitPercent) || !finite(row.stealPercent)) throw new Error("Invalid or mismatched machine metrics file");
  }
  if (new Set(rows.map(r => r.hostname)).size > 1) throw new Error("Metrics from multiple hosts cannot be combined");
  return rows;
}

export type CreditPoint = { at: string; balance: number };
export function parseCredits(input: unknown): CreditPoint[] {
  const response = input as { MetricDataResults?: { Id: string; StatusCode: string; Timestamps: string[]; Values: number[] }[]; NextToken?: string };
  const result = response?.MetricDataResults?.find(r => r.Id === "creditbalance");
  if (!result || response.NextToken || result.StatusCode !== "Complete" || !Array.isArray(result.Timestamps) || !Array.isArray(result.Values) || result.Timestamps.length !== result.Values.length) throw new Error("Complete CloudWatch creditbalance result required");
  return result.Timestamps.map((at, i) => {
    const balance = result.Values[i]!;
    if (!Number.isFinite(Date.parse(at)) || typeof balance !== "number" || !Number.isFinite(balance) || balance < 0) throw new Error("invalid credit point");
    return { at, balance };
  }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
export function creditProjection(instanceType: string, hours: number, cpuPercent: number | null, points: CreditPoint[], start: string, end: string) {
  // Explicitly support the two candidates; no guessed baselines for other families.
  const supported = ["t4g.small", "t4g.medium"].includes(instanceType);
  const selected = points.filter(p => Date.parse(p.at) >= Date.parse(start) - 300_000 && Date.parse(p.at) <= Date.parse(end) + 300_000);
  if (!supported || cpuPercent === null || selected.length < 2 || !selected.some(p => Date.parse(p.at) <= Date.parse(start)) || !selected.some(p => Date.parse(p.at) >= Date.parse(end))) return null;
  const minimumBalance = selected.reduce((minimum, p) => Math.min(minimum, p.balance), Infinity);
  const drainPerHour = Math.max(0, 2 * 60 * cpuPercent / 100 - 24);
  return { minimumBalance, drainPerHour, hoursUntilEmpty: drainPerHour ? minimumBalance / drainPerHour : null,
    requiredCredits: drainPerHour * hours * 1.25, sufficient: minimumBalance >= drainPerHour * hours * 1.25 };
}
