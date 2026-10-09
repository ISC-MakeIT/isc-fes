import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export const scripts = join(import.meta.dir, "../scripts");
export const fixture = join(import.meta.dir, "fixtures/cli.ts");

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

export function createFixtureCommands(commands: string[]) {
  const root = mkdtempSync(join(tmpdir(), "isc-fes-backup-test-"));
  const bin = join(root, "bin");
  mkdirSync(bin);
  for (const command of commands) {
    writeFileSync(
      join(bin, command),
      `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fixture)} ${quote(command)} "$@"\n`,
      { mode: 0o755 },
    );
  }
  return {
    root,
    bin,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TEST_ROOT: root },
  };
}

export function run(
  command: string[],
  env: NodeJS.ProcessEnv = process.env,
  input?: string | Buffer,
) {
  const [program, ...args] = command;
  if (!program) throw new Error("Command is required.");
  const result = spawnSync(program, args, { env, input, encoding: "utf8", timeout: 30_000 });
  if (result.error) throw result.error;
  return result;
}

export function checked(
  command: string[],
  env: NodeJS.ProcessEnv = process.env,
  input?: string | Buffer,
) {
  const result = run(command, env, input);
  if (result.status !== 0) throw new Error(`${command[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}
