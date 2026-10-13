import type { Config } from "./config";
import type { RunResult, StageResult } from "./runner";
import { creditProjection, summarizeMachine, type MachineSample, type CreditPoint } from "./metrics";

export type Gate = { status: "pass" | "fail" | "inconclusive"; failures: string[]; missing: string[] };
export function evaluate(c: Config, entry: StageResult, machine: ReturnType<typeof summarizeMachine>, credits: ReturnType<typeof creditProjection>): Gate {
  const m = entry.measurements, failures: string[] = [], missing: string[] = [];
  const require = (ok: boolean, label: string) => { if (!ok) failures.push(label); };
  if (!entry.start || !entry.end || m.durationMs < entry.stage.durationSeconds * 1000) missing.push("測定時間が不足");
  require(m.ws.availability >= c.slo.wsAvailability, "WS 接続維持率");
  require(m.ws.protocolErrors === 0, "WS メッセージ形式");
  const ready = entry.ramp.operations["ws.ready"];
  if (ready) require((ready.errorRate ?? 1) <= c.slo.errorRate, "WS 初期同期の失敗率");
  if (entry.stage.workflowsPerSecond > 0) {
    require(m.droppedRate <= c.slo.droppedRate, "操作開始の取りこぼし率");
    require((m.workflowErrorRate ?? 1) <= c.slo.workflowErrorRate, "操作全体の失敗率");
    if (m.started < c.slo.minSamples) missing.push("操作のサンプル不足");
    const http = Object.entries(m.operations).filter(([name]) => !name.startsWith("ws."));
    if (!http.length) missing.push("HTTP 計測なし");
    const expected = ["GET stores", "GET store", "GET menus", "GET toppings", "GET orders"];
    if (c.cartProbability + c.checkoutProbability < 1) expected.push("GET rooms", "GET allergens");
    if (c.cartProbability + c.checkoutProbability > 0) expected.push("GET cart", "PUT cart.add", "PUT cart.quantity");
    if (c.cartProbability > 0) expected.push("PUT cart.remove");
    if (c.checkoutProbability > 0) expected.push("POST order", "GET order", "PATCH order.ready", "PATCH order.completed", "GET kitchen orders");
    if (c.kitchenPollingSeconds > 0) expected.push("GET kitchen poll");
    for (const name of expected) if (!m.operations[name]) missing.push(`${name}: 未計測`);
    for (const [name, op] of http) {
      require((op.errorRate ?? 1) <= c.slo.errorRate, `${name}: 失敗率`);
      if (op.count < c.slo.minSamples) { missing.push(`${name}: サンプル不足`); continue; }
      require((op.p95Ms ?? Infinity) <= c.slo.httpP95Ms, `${name}: p95`);
      require((op.p99Ms ?? Infinity) <= c.slo.httpP99Ms, `${name}: p99`);
    }
    if (c.checkoutProbability > 0 && entry.stage.connections > 0) {
      const notification = m.operations["ws.notification"];
      if (!notification || notification.count < c.slo.minSamples) missing.push("注文通知のサンプル不足");
      if (notification) {
        require((notification.errorRate ?? 1) <= c.slo.notificationErrorRate, "注文通知の未到達率");
        require((notification.successLatency.p95Ms ?? Infinity) <= c.slo.notificationP95Ms, "注文通知の p95");
      }
      if (!m.operations["PATCH order.ready"] || !m.operations["PATCH order.completed"]) missing.push("注文ライフサイクルが未計測");
    }
  }
  if ((m.generatorLag.p99Ms ?? Infinity) > c.slo.generatorLagP99Ms || (m.generatorLag.maxMs ?? Infinity) > c.slo.generatorLagP99Ms * 5) missing.push("負荷生成機のイベントループ遅延");
  if (machine.count < 2 || machine.coverage < .9 || machine.maxGapSeconds > 15) missing.push("対象サーバーのマシン計測の欠落/時間不一致");
  if (machine.cpuMaxPercent !== null) require(machine.cpuMaxPercent <= c.slo.cpuMaxPercent, "CPU 余裕");
  if (machine.memoryMaxPercent !== null) require(machine.memoryMaxPercent <= c.slo.memoryMaxPercent, "メモリ余裕");
  if (machine.swapMaxBytes !== null) require(machine.swapMaxBytes === 0, "Swap 使用あり");
  if (/^t\d/.test(c.instanceType)) {
    if (!credits) missing.push("CPU クレジットの前後データ/対応 instance type が不足");
    else require(credits.sufficient, "学園祭稼働時間の CPU クレジット不足");
  }
  // A generator bottleneck prevents attributing failures to the server.
  const generatorLimited = missing.includes("負荷生成機のイベントループ遅延");
  return { status: generatorLimited ? "inconclusive" : failures.length ? "fail" : missing.length ? "inconclusive" : "pass", failures, missing };
}

export function buildReport(run: RunResult, samples: MachineSample[] = [], points: CreditPoint[] = []) {
  const stages = run.stages.map(entry => {
    const machine = summarizeMachine(samples, entry.start, entry.end);
    const credits = creditProjection(run.config.instanceType, run.config.festivalHours, machine.cpuMeanPercent, points, entry.start, entry.end);
    return { name: entry.stage.name, stage: entry.stage, start: entry.start, end: entry.end, measurements: entry.measurements, ramp: entry.ramp, warmup: entry.warmup, machine, credits, gate: evaluate(run.config, entry, machine, credits) };
  });
  return { schemaVersion: 1 as const, runId: run.runId, label: run.config.label, instanceType: run.config.instanceType, sourceFingerprint: run.sourceFingerprint,
    runStatus: run.status, config: run.config, generator: run.generator, stages,
    highestPassingConnections: run.status === "completed" ? Math.max(0, ...stages.filter(s => s.gate.status === "pass").map(s => s.stage.connections)) : null };
}
export type Report = ReturnType<typeof buildReport>;
function cell(value: string): string { return value.replace(/[|\n\r]/g, " "); }
const n = (value: number | null, digits = 1) => value === null ? "—" : value.toFixed(digits);
export function markdownReport(r: Report): string {
  const lines = [
    `# Benchmark: ${cell(r.label)}`, "", `Instance: ${cell(r.instanceType)} / Run: ${r.runId} / 状態: ${r.runStatus}`, "",
    "| Stage | WS 目標 | WS 平均 | 操作/s 目標 | HTTP/s 実測* | 開始取りこぼし | CPU 最大 | メモリ最大 | 判定 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const s of r.stages) {
    const m = s.measurements;
    const httpCount = Object.entries(m.operations).filter(([name]) => !name.startsWith("ws.")).reduce((sum, [, op]) => sum + op.count, 0);
    lines.push(`| ${cell(s.name)} | ${s.stage.connections} | ${n(m.ws.mean)} | ${s.stage.workflowsPerSecond} | ${n(httpCount / (m.durationMs / 1000))} | ${n(m.droppedRate * 100)}% | ${n(s.machine.cpuMaxPercent)}% | ${n(s.machine.memoryMaxPercent)}% | ${s.gate.status} |`);
  }
  lines.push("", "*HTTP 件数はこの段階で開始した操作の drain 中の完了も含む。RPS は観測時間で割った概算。", "", "## 段階別の詳細", "");
  for (const s of r.stages) {
    const ready = s.ramp.operations["ws.ready"];
    lines.push(`### ${cell(s.name)}`, "", `観測: ${s.start} → ${s.end}`, "",
      `WS 維持率 ${n(s.measurements.ws.availability * 100, 3)}%。マシン計測カバー率 ${n(s.machine.coverage * 100)}%。`, "",
      `新規 WS 初期同期: ${ready?.count ?? 0} 件、失敗 ${ready?.failures ?? 0} 件、p95 ${n(ready?.p95Ms ?? null)} ms。既存接続は次の段階でも維持する。`,
      `予期しない切断: ${cell(JSON.stringify(s.measurements.ws.unexpectedCloses))}。負荷生成機の遅延 p99 ${n(s.measurements.generatorLag.p99Ms)} ms。`, "",
      "| Operation | 件数 | 失敗 | p50 ms | p95 ms | p99 ms | 最大 ms |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const [name, op] of Object.entries(s.measurements.operations)) lines.push(`| ${cell(name)} | ${op.count} | ${op.failures} | ${n(op.p50Ms)} | ${n(op.p95Ms)} | ${n(op.p99Ms)} | ${n(op.maxMs)} |`);
    lines.push("", `失敗条件: ${s.gate.failures.map(cell).join("、") || "なし"}。`, `不足情報: ${s.gate.missing.map(cell).join("、") || "なし"}。`, "");
    if (s.credits) lines.push(`CPU クレジット最小 ${n(s.credits.minimumBalance)}、推定消費 ${n(s.credits.drainPerHour)} credits/h、${r.config.festivalHours} 時間 + 25% 余裕に必要な残高 ${n(s.credits.requiredCredits)}。`, "");
  }
  lines.push("## 判定の前提", "", "pass は指定した条件での実測結果。絶対的な最大同接ではない。inconclusive はサンプル、対象メトリクス、CPU クレジット、または負荷生成機の余裕が不足。比較には同一ビルド・設定・DB の初期状態を使い、ピーク + 余裕の段階を繰り返し計測する。", "");
  return lines.join("\n");
}

export function comparableConfig(c: Config): string {
  const { label: _label, instanceType: _instanceType, baseUrl: _baseUrl, origin: _origin, ...scenario } = c;
  return JSON.stringify(scenario);
}
export function compareReports(small: Report, medium: Report, requiredConnections: number, requiredRate: number) {
  if (small.instanceType !== "t4g.small" || medium.instanceType !== "t4g.medium") throw new Error("Comparison requires t4g.small and t4g.medium reports");
  if (small.sourceFingerprint !== medium.sourceFingerprint || comparableConfig(small.config) !== comparableConfig(medium.config)) throw new Error("Different source/scenario/SLO: reports cannot be compared");
  const runtime = (r: Report) => JSON.stringify([r.generator.hostname, r.generator.bunVersion, r.generator.platform, r.generator.arch, r.generator.cpuCount]);
  if (runtime(small) !== runtime(medium)) throw new Error("Generator host/runtime/architecture/CPU count differ");
  const choose = (r: Report) => r.runStatus === "completed" ? r.stages.find(s => s.stage.connections >= requiredConnections && s.stage.workflowsPerSecond >= requiredRate && s.gate.status === "pass") : undefined;
  const smallPass = choose(small), mediumPass = choose(medium);
  const recommendation = smallPass ? "t4g.small" : mediumPass ? "t4g.medium" : "inconclusive";
  const reason = smallPass ? "small が指定したピーク + 余裕の同接・操作レート・SLO・マシン余裕・クレジット条件を満たした。" : mediumPass ? "medium は条件を満たした。small に不足情報がある場合は medium が必要という証明ではなく、合格を確認できた候補。" : "指定負荷で合格した候補なし。欠落データを補うか、負荷・ボトルネック・構成を再検討する。";
  return { recommendation, reason, requiredConnections, requiredRate, smallPassingStage: smallPass?.name ?? null, mediumPassingStage: mediumPass?.name ?? null,
    caveat: "暫定判定。反復計測と長時間 soak で確認する。small/medium は同じ vCPU 数・CPU baseline のため、CPU が原因なら medium で改善する保証はない。" };
}
