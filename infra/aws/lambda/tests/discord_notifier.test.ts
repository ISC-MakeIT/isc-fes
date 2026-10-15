import { describe, expect, test } from "bun:test";
import { alarmPayload, postToDiscord } from "../discord_notifier.mjs";

const webhook = "https://discord.com/api/webhooks/123456789/example-secret-token";
const alarm = {
  AlarmName: "isc-fes-api-server-memory",
  NewStateValue: "ALARM",
  OldStateValue: "OK",
  NewStateReason: "Memory usage >= 85%",
  StateChangeTime: "2026-10-14T12:00:00Z",
};

describe("CloudWatch alarm payload", () => {
  test("ALARM and OK include reason, time, severity and console link", () => {
    for (const [state, color] of [["ALARM", 0xe74c3c], ["OK", 0x2ecc71]] as const) {
      const embed = alarmPayload(JSON.stringify({ ...alarm, NewStateValue: state })).embeds[0]!;
      expect(embed.color).toBe(color);
      expect(embed.title).toBe(`${state}: ${alarm.AlarmName}`);
      expect(embed.description).toBe(alarm.NewStateReason);
      expect(embed.url).toContain(alarm.AlarmName);
      expect(embed.fields[1]!.value).toBe(alarm.StateChangeTime);
    }
  });

  test("bounds long text to Discord limits, escapes names and suppresses mentions", () => {
    const payload = alarmPayload(JSON.stringify({ ...alarm, AlarmName: "@everyone/".repeat(100), NewStateReason: "x".repeat(8000) }));
    const embed = payload.embeds[0]!;
    expect(embed.title.length).toBeLessThanOrEqual(256);
    expect(embed.description.length).toBeLessThanOrEqual(1800);
    expect(embed.url).toContain("%2F");
    expect(payload.allowed_mentions).toEqual({ parse: [], users: [] });
    expect(payload.content).toBeUndefined();
  });

  test("mentions only the configured users", () => {
    const ids = ["123456789012345678", "987654321098765432"];
    const payload = alarmPayload(JSON.stringify({ ...alarm, NewStateReason: "@everyone <@111111111111111111> <@&222222222222222222>" }), ids);
    expect(payload.content).toBe("<@123456789012345678> <@987654321098765432>");
    expect(payload.allowed_mentions).toEqual({ parse: [], users: ids });
  });

  test("rejects malformed, non-alarm and missing-name messages", () => {
    for (const message of ["not-json", "null", "{}", JSON.stringify({ ...alarm, NewStateValue: "INSUFFICIENT_DATA" }), JSON.stringify({ ...alarm, AlarmName: "" })]) {
      expect(() => alarmPayload(message)).toThrow();
    }
  });
});

describe("Discord delivery", () => {
  const payload = alarmPayload(JSON.stringify(alarm));

  test("treats every non-200 response as a failure so Lambda retries it", async () => {
    for (const status of [204, 302, 400, 429, 503]) {
      await expect(postToDiscord(webhook, payload, async () => new Response(null, { status }))).rejects.toThrow(`HTTP ${status}`);
    }
  });

  test("network errors never expose the webhook URL", async () => {
    const error = await postToDiscord(webhook, payload, async () => { throw new Error(webhook); }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Discord delivery failed (network error)");
    expect((error as Error).cause).toBeUndefined();
  });
});
