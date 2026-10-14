// Logarithmic upper-bound buckets, ~2% quantile error, bounded memory even in a long soak.
export class Histogram {
  private buckets = new Map<number, number>();
  count = 0;
  sum = 0;
  max = 0;
  add(value: number): void {
    if (!Number.isFinite(value) || value < 0) throw new Error("invalid latency");
    const bucket = value <= 1 ? 0 : Math.ceil(Math.log(value) / Math.log(1.02));
    this.buckets.set(bucket, (this.buckets.get(bucket) ?? 0) + 1);
    this.count++; this.sum += value; this.max = Math.max(this.max, value);
  }
  percentile(q: number): number | null {
    if (!this.count) return null;
    const rank = Math.max(1, Math.ceil(this.count * q));
    let seen = 0;
    for (const [bucket, count] of [...this.buckets].sort((a, b) => a[0] - b[0])) {
      seen += count;
      if (seen >= rank) return Math.min(this.max, Math.pow(1.02, bucket));
    }
    return this.max;
  }
  summary() { return { count: this.count, meanMs: this.count ? this.sum / this.count : null, p50Ms: this.percentile(.5), p95Ms: this.percentile(.95), p99Ms: this.percentile(.99), maxMs: this.count ? this.max : null }; }
}
export class Operation {
  latency = new Histogram();
  successLatency = new Histogram();
  failures = 0;
  statuses: Record<string, number> = {};
  bytes = 0;
  add(ms: number, success: boolean, status: string, bytes = 0): void {
    this.latency.add(ms);
    if (success) this.successLatency.add(ms); else this.failures++;
    this.statuses[status] = (this.statuses[status] ?? 0) + 1;
    this.bytes += bytes;
  }
  summary() { return { ...this.latency.summary(), failures: this.failures, errorRate: this.latency.count ? this.failures / this.latency.count : null, statuses: this.statuses, bytes: this.bytes, successLatency: this.successLatency.summary() }; }
}
export class Recorder {
  operations = new Map<string, Operation>();
  scheduled = 0;
  dropped = 0;
  started = 0;
  workflowFailures = 0;
  workflowSettled = 0;
  schedulerLag = new Histogram();
  generatorLag = new Histogram();
  wsUnexpectedCloses: Record<string, number> = {};
  wsProtocolErrors = 0;
  wsMessages = 0;
  wsBytes = 0;
  wsIntegral = 0;
  wsMin = Infinity;
  wsMax = 0;
  wsLastAt = 0;
  wsCurrent = 0;
  constructor(public name: string) {}
  record(name: string, ms: number, ok: boolean, status: string, bytes = 0): void {
    let op = this.operations.get(name);
    if (!op) { op = new Operation(); this.operations.set(name, op); }
    op.add(ms, ok, status, bytes);
  }
  beginGauge(at: number, active: number): void { this.wsLastAt = at; this.wsCurrent = active; this.wsMin = active; this.wsMax = active; }
  gauge(at: number, active: number): void {
    this.wsIntegral += Math.max(0, at - this.wsLastAt) * this.wsCurrent;
    this.wsLastAt = at; this.wsCurrent = active;
    this.wsMin = Math.min(this.wsMin, active); this.wsMax = Math.max(this.wsMax, active);
  }
  summary(durationMs: number, target: number) {
    return {
      name: this.name, durationMs, scheduled: this.scheduled, started: this.started, dropped: this.dropped,
      droppedRate: this.scheduled ? this.dropped / this.scheduled : 0,
      workflowSettled: this.workflowSettled, workflowSucceeded: this.workflowSettled - this.workflowFailures, workflowFailures: this.workflowFailures,
      workflowErrorRate: this.started ? this.workflowFailures / this.started : null,
      schedulerLag: this.schedulerLag.summary(), generatorLag: this.generatorLag.summary(),
      ws: { target, mean: this.wsIntegral / durationMs, min: this.wsMin, max: this.wsMax,
        availability: target ? this.wsIntegral / (durationMs * target) : 1,
        unexpectedCloses: this.wsUnexpectedCloses, protocolErrors: this.wsProtocolErrors, messages: this.wsMessages, bytes: this.wsBytes },
      operations: Object.fromEntries([...this.operations].map(([k, v]) => [k, v.summary()])),
    };
  }
}
export type Measurements = ReturnType<Recorder["summary"]>;
