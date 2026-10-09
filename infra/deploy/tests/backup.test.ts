import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { notifyBackupFailure } from "../scripts/notify-backup-failure";
import { createFixtureCommands, run, scripts } from "./helpers";

describe("Discord failure notification", () => {
  const webhook = "https://discord.com/api/webhooks/123/secret-token";
  const noSleep = async () => {};

  test("honors rate-limit retry_after", async () => {
    let attempts = 0;
    const sleeps: number[] = [];
    await notifyBackupFailure(webhook, "dump", "run", {
      send: async () =>
        ++attempts === 1 ? Response.json({ retry_after: 3 }, { status: 429 }) : new Response("{}"),
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      },
    });
    expect(attempts).toBe(2);
    expect(sleeps).toEqual([3_000]);
  });

  test("bounds network retries without exposing the original exception", async () => {
    let attempts = 0;
    await expect(
      notifyBackupFailure(webhook, "dump", "run", {
        send: async () => {
          attempts++;
          throw new Error(webhook);
        },
        sleep: noSleep,
      }),
    ).rejects.toThrow("failed after four attempts");
    expect(attempts).toBe(4);
  });

  test("does not retry permanent errors or exceed the retry budget", async () => {
    for (const response of [
      new Response("", { status: 404 }),
      Response.json({ retry_after: 61 }, { status: 429 }),
    ]) {
      let attempts = 0;
      await expect(
        notifyBackupFailure(webhook, "dump", "run", {
          send: async () => {
            attempts++;
            return response;
          },
          sleep: noSleep,
        }),
      ).rejects.toThrow();
      expect(attempts).toBe(1);
    }
  });
});

describe("SSM backup orchestration", () => {
  let fixture: ReturnType<typeof createFixtureCommands>;
  beforeEach(() => {
    fixture = createFixtureCommands(["aws", "sleep"]);
  });
  afterEach(() => {
    rmSync(fixture.root, { recursive: true, force: true });
  });

  const runBackup = (statuses: string[]) =>
    run(["bash", join(scripts, "backup-db.sh")], {
      ...fixture.env,
      AWS_ACCOUNT_ID: "123456789012",
      BACKUP_RUN_ID: "100-1",
      GITHUB_OUTPUT: join(fixture.root, "output"),
      TEST_STATUSES: JSON.stringify(statuses),
    });

  test("waits for terminal success and tolerates eventual consistency", () => {
    expect(runBackup(["NotFound", "InProgress", "Success"]).status).toBe(0);
    expect(readFileSync(join(fixture.root, "polls"), "utf8")).toBe("3");
  });

  test.each(["Failed", "TimedOut", "Cancelled"])("propagates %s as failure", (status) => {
    expect(runBackup([status]).status).not.toBe(0);
    const stage = status === "Failed" ? "manifest-upload" : `ssm-${status}`;
    expect(readFileSync(join(fixture.root, "output"), "utf8")).toContain(`failure_stage=${stage}`);
  });
});
