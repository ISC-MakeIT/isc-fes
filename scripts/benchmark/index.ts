import { parseArgs } from "node:util";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { parseConfig } from "./config";
import { run, type RunResult } from "./runner";
import { buildReport, markdownReport, compareReports, type Report } from "./report";
import { parseMachineSamples, parseCredits } from "./metrics";

const usage = `Bun performance benchmark (no network unless run --execute):
  bun run benchmark plan --config scripts/benchmark/mixed.example.json
  bun run benchmark run --config scripts/benchmark/mixed.local.json --out benchmark-results/small-1 --execute
  bun run benchmark report --result benchmark-results/small-1/result.json --metrics small-1.metrics.jsonl --credits small-1.credits.json --out benchmark-results/small-1
  bun run benchmark compare --small benchmark-results/small-1/report.json --medium benchmark-results/medium-1/report.json --connections 1500 --rate 60 --out benchmark-results/comparison

plan / run without --execute: configuration and workload plan only.
report / compare: offline files only. Metrics and credits are optional; missing evidence produces inconclusive.
See scripts/benchmark/README.md for fixtures, metrics and assumptions.`;

async function atomicJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  await rename(temporary, path);
}
async function sourceFingerprint(): Promise<string> {
  const hash = new Bun.CryptoHasher("sha256");
  for (const name of ["config.ts", "stats.ts", "client.ts", "scenario.ts", "runner.ts", "metrics.ts", "collect-metrics.ts", "report.ts", "index.ts"]) {
    hash.update(name); hash.update(await Bun.file(resolve(import.meta.dir, name)).arrayBuffer());
  }
  return hash.digest("hex");
}
export async function main(args: string[] = Bun.argv.slice(2)): Promise<void> {
  const command = args[0];
  if (!command || command === "--help" || command === "-h") { console.log(usage); return; }
  const { values, positionals } = parseArgs({ args: args.slice(1), allowPositionals: true, strict: true, options: {
    config: { type: "string" }, execute: { type: "boolean", default: false }, out: { type: "string" }, result: { type: "string" },
    metrics: { type: "string" }, credits: { type: "string" }, small: { type: "string" }, medium: { type: "string" },
    connections: { type: "string" }, rate: { type: "string" }, help: { type: "boolean" },
  } });
  if (values.help) { console.log(usage); return; }
  if (positionals.length) throw new Error("Unexpected positional argument");
  const allowed: Record<string, string[]> = {
    plan: ["config"], run: ["config", "execute", "out"], report: ["result", "metrics", "credits", "out"], compare: ["small", "medium", "connections", "rate", "out"],
  };
  if (!allowed[command]) throw new Error(usage);
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== false && !allowed[command]!.includes(key)) throw new Error(`Unexpected --${key} for ${command}`);
  if (command === "plan" || command === "run") {
    if (!values.config) throw new Error("--config required");
    const config = parseConfig(await Bun.file(values.config).json());
    if (command === "plan" || !values.execute) {
      console.log(JSON.stringify({ mode: "plan-only", config, assumptions: {
        arrivalUnit: "visitor workflows/s (each workflow sends multiple HTTP requests)",
        checkoutLifecycle: "cart -> POST order -> staff PATCH ready -> staff PATCH completed",
        staffPollSeconds: config.kitchenPollingSeconds, machineMetrics: "separate Linux target collector, joined offline",
        apiAndDatabaseWrites: "run --execute only; guests/carts/orders persist until disposable database is discarded",
      } }, null, 2));
      return;
    }
    if (!values.out) throw new Error("--out required for execution");
    const out = resolve(values.out);
    // Refuse reusing a directory so samples from two runs are never accidentally mixed.
    await mkdir(dirname(out), { recursive: true });
    await mkdir(out);
    const timeline = Bun.file(resolve(out, "timeline.jsonl")).writer();
    try {
      const result = await run(config, await sourceFingerprint(), async row => {
        timeline.write(JSON.stringify(row) + "\n"); await timeline.flush();
        console.log(JSON.stringify(row));
      }, r => atomicJson(resolve(out, "result.json"), r));
      const report = buildReport(result);
      await atomicJson(resolve(out, "report.json"), report);
      await writeFile(resolve(out, "report.md"), markdownReport(report));
      if (result.status !== "completed") process.exitCode = result.status === "interrupted" ? 130 : 1;
    } finally { await timeline.end(); }
    return;
  }
  if (!values.out) throw new Error("--out required");
  const out = resolve(values.out);
  if (command === "report") {
    if (!values.result) throw new Error("--result required");
    const input = await Bun.file(values.result).json() as RunResult;
    if (input.schemaVersion !== 1 || !Array.isArray(input.stages) || !["completed", "interrupted", "failed"].includes(input.status) || typeof input.sourceFingerprint !== "string") throw new Error("Invalid result file");
    input.config = parseConfig(input.config);
    const samples = values.metrics ? parseMachineSamples(await Bun.file(values.metrics).text(), input.config.label, input.config.instanceType) : [];
    const credits = values.credits ? await Bun.file(values.credits).json() : null;
    // The export wrapper binds otherwise anonymous CloudWatch results to the intended run/host.
    if (credits && (credits.label !== input.config.label || credits.instanceType !== input.config.instanceType || credits.creditsMode !== "standard" || typeof credits.instanceId !== "string")) throw new Error("Mismatched credits metadata or unsupported creditsMode (standard required)");
    const report = buildReport(input, samples, credits ? parseCredits(credits.cloudWatch) : []);
    await atomicJson(resolve(out, "report.json"), report);
    await writeFile(resolve(out, "report.md"), markdownReport(report));
    console.log(`Offline report: ${resolve(out, "report.md")}`);
    return;
  }
  if (!values.small || !values.medium || values.connections === undefined || values.rate === undefined) throw new Error("--small --medium --connections --rate required");
  const connections = Number(values.connections), rate = Number(values.rate);
  if (!Number.isInteger(connections) || connections < 1 || !Number.isFinite(rate) || rate < 0) throw new Error("Positive connections and nonnegative rate must be specified");
  const small = await Bun.file(values.small).json() as Report, medium = await Bun.file(values.medium).json() as Report;
  if (small.schemaVersion !== 1 || medium.schemaVersion !== 1 || !Array.isArray(small.stages) || !Array.isArray(medium.stages)) throw new Error("Invalid report files");
  const comparison = compareReports(small, medium, connections, rate);
  await atomicJson(resolve(out, "comparison.json"), comparison);
  await writeFile(resolve(out, "comparison.md"), `# Instance comparison\n\n候補: ${comparison.recommendation}\n\n${comparison.reason}\n\n必要負荷: ${connections} WS / ${rate} workflows/s\n\n${comparison.caveat}\n`);
  console.log(JSON.stringify(comparison, null, 2));
}

if (import.meta.main) main().catch(error => {
  // Network errors are sanitized in Api. Config/file errors contain no cookie values.
  console.error(error instanceof Error ? error.message : "benchmark failed"); process.exitCode = 1;
});
