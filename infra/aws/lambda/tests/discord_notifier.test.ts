import { describe, expect, test } from "bun:test";
import { alarmPayload, postToDiscord } from "../discord_notifier.mjs";

const webhook = "https://discord.com/api/webhooks/123456789/example-secret-token";
const alarm = {
  AlarmName: "isc-fes-api-server-memory",
  AlarmDescription: "メモリ使用率が85%以上で3分継続",
  NewStateValue: "ALARM",
  OldStateValue: "OK",
  NewStateReason: "Memory usage >= 85%",
  StateChangeTime: "2026-10-15T07:05:52.100+0000",
};

describe("CloudWatch alarm payload", () => {
  test("ALARM and OK are labeled in Japanese with the description, reason and console link", () => {
    for (const [state, label, color] of [["ALARM", "🚨 発生", 0xe74c3c], ["OK", "✅ 復旧", 0x2ecc71]] as const) {
      const embed = alarmPayload(JSON.stringify({ ...alarm, NewStateValue: state })).embeds[0]!;
      expect(embed.color).toBe(color);
      expect(embed.title).toBe(`${label}: ${alarm.AlarmDescription}`);
      expect(embed.description).toContain(alarm.NewStateReason);
      expect(embed.url).toContain(alarm.AlarmName);
      expect(embed.fields[0]!.value).toBe(alarm.AlarmName);
    }
  });

  test("falls back to the alarm name when the description is missing", () => {
    const { AlarmDescription: _, ...withoutDescription } = alarm;
    expect(alarmPayload(JSON.stringify(withoutDescription)).embeds[0]!.title).toBe(`🚨 発生: ${alarm.AlarmName}`);
  });

  test("shows the previous state in Japanese and the change time in JST", () => {
    const fields = alarmPayload(JSON.stringify({ ...alarm, OldStateValue: "INSUFFICIENT_DATA" })).embeds[0]!.fields;
    expect(fields[1]!.value).toBe("データ不足");
    expect(fields[2]!.value).toBe("2026/10/15 16:05:52");
  });

  test("keeps an unparseable change time as is", () => {
    const fields = alarmPayload(JSON.stringify({ ...alarm, StateChangeTime: "Manual smoke test" })).embeds[0]!.fields;
    expect(fields[2]!.value).toBe("Manual smoke test");
  });

  test("bounds long text to Discord limits, escapes names and suppresses mentions", () => {
    const payload = alarmPayload(JSON.stringify({ ...alarm, AlarmName: "@everyone/".repeat(100), AlarmDescription: "説".repeat(500), NewStateReason: "x".repeat(8000) }));
    const embed = payload.embeds[0]!;
    expect(embed.title.length).toBeLessThanOrEqual(256);
    expect(embed.description.length).toBeLessThanOrEqual(4096);
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
