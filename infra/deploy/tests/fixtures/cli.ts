// subprocess境界だけを置換する。Docker操作は専用test projectへ限定する。
import { basename, dirname, join } from "node:path";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [mode, ...args] = Bun.argv.slice(2);
const root = Bun.env.TEST_ROOT!;
const fault = Bun.env.TEST_FAULT;
if (mode === "sleep") process.exit(0);
if (mode === "aws") {
  const action = args.slice(0, 2).join(" ");
  if (Bun.env.TEST_STORE) {
    if (action !== "s3 cp") process.exit(2);
    const destination = join(Bun.env.TEST_STORE, args[3]!.split("/").slice(3).join("/"));
    if (fault === basename(destination)) process.exit(1);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(args[2]!, destination);
  } else if (action === "sts get-caller-identity") {
    console.log("123456789012");
  } else if (action === "ec2 describe-instances") {
    console.log('["i-0123456789abcdef0"]');
  } else if (action === "ssm send-command") {
    const parameters = args[args.indexOf("--parameters") + 1]!.replace(/^file:\/\//, "");
    copyFileSync(parameters, join(root, "parameters.json"));
    console.log("00000000-0000-0000-0000-000000000001");
  } else if (action === "ssm get-command-invocation") {
    const statuses: string[] = JSON.parse(Bun.env.TEST_STATUSES ?? '["Success"]');
    const countFile = join(root, "polls");
    const count = existsSync(countFile) ? Number(readFileSync(countFile, "utf8")) : 0;
    writeFileSync(countFile, String(count + 1));
    const status = statuses[Math.min(count, statuses.length - 1)];
    if (status === "NotFound") {
      console.error("InvocationDoesNotExist");
      process.exit(1);
    }
    console.log(
      JSON.stringify({
        Status: status,
        StandardOutputContent: "safe output",
        StandardErrorContent: status === "Failed" ? "BACKUP_FAILED_STAGE=manifest-upload" : "",
      }),
    );
  } else process.exit(2);
} else if (mode === "docker") {
  const translated = args.map((arg) =>
    arg.replace(
      "label=com.docker.compose.project=isc-fes",
      `label=com.docker.compose.project=${Bun.env.TEST_PROJECT}`,
    ),
  );
  if (translated[0] === "exec" && translated.some((arg) => arg.includes("pg_dump --format"))) {
    if (fault === "invalid-dump") {
      console.log("not a PostgreSQL archive");
      process.exit(0);
    }
    if (fault === "slow-dump")
      translated[translated.length - 1] =
        'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT pg_sleep(60);"';
  }
  const result = spawnSync(Bun.env.TEST_DOCKER!, translated, { stdio: "inherit" });
  process.exit(result.status ?? 1);
} else process.exit(2);
