import { hostname } from "node:os";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parseCpu, cpuDelta, parseMemory, parseNetwork, networkDelta, parseDisks, diskDelta, parsePressure, type MachineSample } from "./metrics";
import { parseArgs } from "node:util";
import { pause } from "./scenario";
import { readInstanceIdentity } from "./identity";

async function optional(path: string): Promise<string> { try { return await Bun.file(path).text(); } catch { return ""; } }
async function read() {
  const [cpu, memory, network, disks, load, files, cpuPressure, memPressure, ioPressure] = await Promise.all([
    Bun.file("/proc/stat").text(), Bun.file("/proc/meminfo").text(), Bun.file("/proc/net/dev").text(), Bun.file("/proc/diskstats").text(), Bun.file("/proc/loadavg").text(),
    optional("/proc/sys/fs/file-nr"), optional("/proc/pressure/cpu"), optional("/proc/pressure/memory"), optional("/proc/pressure/io"),
  ]);
  return { monotonic: performance.now(), at: new Date().toISOString(), cpu: parseCpu(cpu), memory: parseMemory(memory), network: parseNetwork(network), disks: parseDisks(disks),
    load1: Number(load.split(" ")[0]), openFiles: files ? Number(files.trim().split(/\s+/)[0]) : null,
    pressure: { cpu: parsePressure(cpuPressure), memory: parsePressure(memPressure), io: parsePressure(ioPressure) } };
}
async function dockerStats(): Promise<{ containers: unknown[] | null; dockerError: boolean }> {
  try {
    const child = Bun.spawn(["docker", "stats", "--no-stream", "--format", "{{json .}}"], { stdout: "pipe", stderr: "ignore" });
    const timer = setTimeout(() => child.kill("SIGKILL"), 4000);
    try {
      const [text, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
      if (code !== 0) throw new Error("docker stats failed");
      return { containers: text.trim() ? text.trim().split("\n").map(line => JSON.parse(line)) : [], dockerError: false };
    } finally { clearTimeout(timer); }
  } catch { return { containers: null, dockerError: true }; }
}

async function main(): Promise<void> {
  const { values } = parseArgs({ args: Bun.argv.slice(2), options: {
    execute: { type: "boolean", default: false }, help: { type: "boolean" },
    label: { type: "string" }, "instance-type": { type: "string" }, out: { type: "string" },
    seconds: { type: "string", default: "3600" }, interval: { type: "string", default: "5" }, docker: { type: "boolean", default: false },
  }, strict: true });
  const usage = "Target Linux host: bun run collect-metrics.ts --label small-1 --instance-type t4g.small --seconds 3600 --interval 5 --docker --out /tmp/small-1.metrics.jsonl --execute";
  if (values.help) { console.log(usage); return; }
  const seconds = Number(values.seconds), interval = Number(values.interval);
  if (!values.label || !values["instance-type"] || !values.out || !Number.isFinite(seconds) || seconds < 1 || seconds > 172800 || !Number.isFinite(interval) || interval < 1 || interval > 60) throw new Error(usage);
  if (!values.execute) { console.log(`Plan only: collect CPU/memory/network/disk/pressure${values.docker ? "/Docker" : ""} every ${interval}s for ${seconds}s. Add --execute to collect.`); return; }
  if (process.platform !== "linux") throw new Error("Collector requires Linux on the target host");
  if (await Bun.file(values.out).exists()) throw new Error("Output file already exists");
  const identity = await readInstanceIdentity();
  if (identity.instanceType !== values["instance-type"]) throw new Error("EC2 instance type does not match collector configuration");
  await mkdir(dirname(values.out), { recursive: true });
  const writer = Bun.file(values.out).writer();
  const abort = new AbortController(), stop = () => abort.abort();
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  const started = performance.now();
  try {
    let previous = await read();
    while (!abort.signal.aborted && performance.now() - started < seconds * 1000) {
      await pause(Math.min(interval * 1000, seconds * 1000 - (performance.now() - started)), abort.signal);
      const current = await read(), elapsed = (current.monotonic - previous.monotonic) / 1000;
      const sample: MachineSample = {
        schemaVersion: 1, at: current.at, intervalSeconds: elapsed, label: values.label, ...identity, hostname: hostname(),
        ...cpuDelta(previous.cpu, current.cpu), ...current.memory, load1: current.load1, openFiles: current.openFiles, pressure: current.pressure,
        network: networkDelta(previous.network, current.network, elapsed), disks: diskDelta(previous.disks, current.disks, elapsed),
        ...(values.docker ? await dockerStats() : { containers: null, dockerError: false }),
      };
      writer.write(JSON.stringify(sample) + "\n"); await writer.flush(); previous = current;
    }
  } catch (error) { if (!abort.signal.aborted) throw error; }
  finally { process.off("SIGINT", stop); process.off("SIGTERM", stop); await writer.end(); }
}

if (import.meta.main) main().catch(error => { console.error(error instanceof Error ? error.message : "metrics collector failed"); process.exitCode = 1; });
