import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { checked, createFixtureCommands, run, scripts } from "./helpers";

describe.skipIf(Bun.env.BACKUP_INTEGRATION !== "1" || process.platform !== "linux")(
  "PostgreSQL backup integration",
  () => {
    const docker = Bun.which("docker")!;
    const project = `isc-fes-backup-test-${crypto.randomUUID()}`;
    let container: string | undefined;
    let fixture: ReturnType<typeof createFixtureCommands>;
    let env: NodeJS.ProcessEnv;
    let store: string;
    const dockerRun = (...args: string[]) => checked([docker, ...args]);
    const db = (...args: string[]) => dockerRun("exec", container!, ...args);
    const sql = (query: string, database = "backup_test") =>
      db("psql", "-U", "postgres", "-d", database, "-At", "-v", "ON_ERROR_STOP=1", "-c", query);

    beforeAll(() => {
      container = dockerRun(
        "run",
        "-d",
        "--network",
        "none",
        "--name",
        project,
        "--label",
        `com.docker.compose.project=${project}`,
        "--label",
        "com.docker.compose.service=db",
        "-e",
        "POSTGRES_USER=postgres",
        "-e",
        "POSTGRES_PASSWORD=test-only",
        "-e",
        "POSTGRES_DB=backup_test",
        "postgres:17-alpine",
      );
      db(
        "sh",
        "-c",
        "for i in $(seq 1 60); do pg_isready -U postgres -d backup_test && exit 0; sleep 1; done; exit 1",
      );
      sql(`CREATE TABLE schema_migrations (version bigint PRIMARY KEY, dirty boolean NOT NULL);
      INSERT INTO schema_migrations VALUES (22, false);
      CREATE TABLE parents (id serial PRIMARY KEY, name text NOT NULL);
      CREATE TABLE children (id serial PRIMARY KEY, parent_id integer REFERENCES parents(id));
      INSERT INTO parents(name) VALUES ('private-backup-probe');
      INSERT INTO children(parent_id) VALUES (1);`);
    }, 30_000);
    afterAll(() => {
      if (container) dockerRun("rm", "-f", "-v", container);
    });
    beforeEach(() => {
      fixture = createFixtureCommands(["aws", "docker"]);
      store = join(fixture.root, "store");
      mkdirSync(store);
      env = {
        ...fixture.env,
        TEST_PROJECT: project,
        TEST_STORE: store,
        TEST_DOCKER: docker,
        BACKUP_WORK_DIR: fixture.root,
      };
    });
    afterEach(() => {
      rmSync(fixture.root, { recursive: true, force: true });
    });
    const runBackup = (fault = "", timeout?: string, runId = "test-1") => {
      const command = [
        "bash",
        join(scripts, "backup-db-remote.sh"),
        "isc-fes-db-backups-123456789012",
        "ap-northeast-1",
        runId,
      ];
      return run(timeout ? ["timeout", "--kill-after=15s", timeout, ...command] : command, {
        ...env,
        TEST_FAULT: fault,
      });
    };
    const manifests = () =>
      readdirSync(store, { recursive: true, encoding: "utf8" }).filter((path) =>
        path.endsWith("manifest.json"),
      );
    const assertClean = () =>
      expect(readdirSync(fixture.root).filter((path) => path.startsWith(".db-backup."))).toEqual(
        [],
      );

    test("verifies dump checksum and restores data, constraints and sequences", () => {
      const result = runBackup();
      expect(result.status).toBe(0);
      expect(result.stdout + result.stderr).not.toContain("private-backup-probe");
      expect(manifests()).toHaveLength(1);
      const manifest = join(store, manifests()[0]!);
      const metadata = JSON.parse(readFileSync(manifest, "utf8"));
      const dump = readFileSync(join(store, metadata.dump_key));
      expect(createHash("sha256").update(dump).digest("hex")).toBe(metadata.sha256);
      expect(dump.length).toBe(metadata.size_bytes);
      db("createdb", "-U", "postgres", "restored");
      try {
        checked(
          [
            docker,
            "exec",
            "-i",
            container!,
            "pg_restore",
            "--exit-on-error",
            "--no-owner",
            "--no-privileges",
            "-U",
            "postgres",
            "-d",
            "restored",
          ],
          process.env,
          dump,
        );
        expect(
          sql(
            "SELECT version FROM schema_migrations; SELECT name FROM parents; INSERT INTO parents(name) VALUES ('next') RETURNING id; SELECT count(*) FROM children;",
            "restored",
          ),
        ).toContain("22\nprivate-backup-probe\n2\n");
        expect(() => sql("INSERT INTO children(parent_id) VALUES (999);", "restored")).toThrow();
      } finally {
        db("dropdb", "-U", "postgres", "restored");
      }
      assertClean();
    }, 30_000);

    test.each(["database.dump", "manifest.json", "invalid-dump"])(
      "does not publish success after %s failure",
      (fault) => {
        expect(runBackup(fault).status).not.toBe(0);
        expect(manifests()).toEqual([]);
        assertClean();
      },
      30_000,
    );

    test.each(["test-1", "20261006T010000Z-00000000-0000-4000-8000-000000000000"])(
      "timeout cleans DB sessions and temporary files for run %s",
      (runId) => {
        const result = runBackup("slow-dump", "2s", runId);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("BACKUP_FAILED_STAGE=dump");
        expect(
          sql(
            "SELECT count(*) FROM pg_stat_activity WHERE application_name LIKE 'isc-fes-backup-%';",
          ),
        ).toBe("0");
        expect(manifests()).toEqual([]);
        assertClean();
      },
      30_000,
    );
  },
);
