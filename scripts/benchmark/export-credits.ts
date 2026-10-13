import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseConfig } from "./config";
import { parseCredits } from "./metrics";
import { parseInstanceId } from "./identity";

async function aws(args: string[]): Promise<unknown> {
  const child = Bun.spawn(["aws", ...args, "--output", "json", "--no-cli-pager"], { stdout: "pipe", stderr: "ignore", env: { ...process.env, AWS_PAGER: "" } });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 60_000);
  try {
    const [text, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
    if (code !== 0) throw new Error("AWS CLI failed: check credentials/permissions/region");
    return JSON.parse(text);
  } finally { clearTimeout(timeout); }
}
export async function main(args: string[] = Bun.argv.slice(2), requestAws: (args: string[]) => Promise<unknown> = aws): Promise<void> {
  const { values } = parseArgs({ args, strict: true, options: {
    result: { type: "string" }, "instance-id": { type: "string" }, region: { type: "string", default: "ap-northeast-1" }, out: { type: "string" },
    execute: { type: "boolean", default: false }, help: { type: "boolean" },
  } });
  const usage = "bun run benchmark:credits --result benchmark-results/small-1/result.json --instance-id i-xxxxxxxxxxxxxxxxx --out small-1.credits.json --execute";
  if (values.help) { console.log(usage); return; }
  if (!values.result || !values.out || !values["instance-id"] || !/^[a-z0-9-]+$/.test(values.region!)) throw new Error(usage);
  const instanceId = parseInstanceId(values["instance-id"]);
  const result = await Bun.file(values.result).json(), config = parseConfig(result.config);
  if (instanceId !== config.targetInstanceId) throw new Error("EC2 instance ID does not match benchmark target");
  const startMs = Date.parse(result.start), endMs = Date.parse(result.end);
  if (result.schemaVersion !== 1 || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) throw new Error("Invalid run time window");
  const queries = [
    { Id: "creditbalance", MetricStat: { Metric: { Namespace: "AWS/EC2", MetricName: "CPUCreditBalance", Dimensions: [{ Name: "InstanceId", Value: values["instance-id"] }] }, Period: 300, Stat: "Minimum" }, ReturnData: true },
    { Id: "creditusage", MetricStat: { Metric: { Namespace: "AWS/EC2", MetricName: "CPUCreditUsage", Dimensions: [{ Name: "InstanceId", Value: values["instance-id"] }] }, Period: 300, Stat: "Sum" }, ReturnData: true },
  ];
  const start = new Date(startMs - 300_000).toISOString(), end = new Date(endMs + 600_000).toISOString();
  if (!values.execute) { console.log(JSON.stringify({ mode: "plan-only", instanceId: values["instance-id"], region: values.region, start, end, queries }, null, 2)); return; }
  const instance = await requestAws(["ec2", "describe-instances", "--instance-ids", instanceId, "--region", values.region!]) as { Reservations: { Instances: { InstanceId: string; InstanceType: string }[] }[] };
  const instances = instance.Reservations.flatMap(r => r.Instances);
  if (instances.length !== 1 || instances[0]!.InstanceId !== config.targetInstanceId || instances[0]!.InstanceType !== config.instanceType) throw new Error("EC2 instance identity does not match benchmark config");
  const specifications = await requestAws(["ec2", "describe-instance-credit-specifications", "--instance-ids", instanceId, "--region", values.region!]) as { InstanceCreditSpecifications: { InstanceId: string; CpuCredits: string }[] };
  const spec = specifications.InstanceCreditSpecifications.find(s => s.InstanceId === values["instance-id"]);
  if (spec?.CpuCredits !== "standard") throw new Error("Credit projection currently supports standard mode only");
  const cloudWatch = await requestAws(["cloudwatch", "get-metric-data", "--region", values.region!, "--start-time", start, "--end-time", end, "--scan-by", "TimestampAscending", "--metric-data-queries", JSON.stringify(queries)]);
  const points = parseCredits(cloudWatch);
  if (!points.some(p => Date.parse(p.at) <= startMs) || !points.some(p => Date.parse(p.at) >= endMs)) throw new Error("Credit data does not bracket the run yet. Export again after CloudWatch publishes the final points");
  await mkdir(dirname(values.out), { recursive: true });
  await writeFile(values.out, JSON.stringify({ label: config.label, instanceType: config.instanceType, instanceId: values["instance-id"], creditsMode: "standard", region: values.region, cloudWatch }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(`Exported credit metrics: ${values.out}`);
}
if (import.meta.main) main().catch(error => { console.error(error instanceof Error ? error.message : "credit export failed"); process.exitCode = 1; });
