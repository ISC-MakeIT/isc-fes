import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, test } from "vitest";
import { shouldShowOngoingMask } from "./should-show-ongoing-mask";

const event = {
  startAt: Temporal.PlainDateTime.from("2026-10-24T10:00"),
  endAt: Temporal.PlainDateTime.from("2026-10-24T11:00"),
};

describe("shouldShowOngoingMask", () => {
  test.each([
    ["開催中表示の開始直前", "2026-10-24T09:54:59", false],
    ["開催中表示の開始時刻", "2026-10-24T09:55:00", true],
    ["イベント開始時刻", "2026-10-24T10:00:00", true],
    ["イベント開催中", "2026-10-24T10:30:00", true],
    ["イベント終了時刻", "2026-10-24T11:00:00", false],
    ["イベント終了後", "2026-10-24T11:00:01", false],
  ])("%sの場合は%sを返す", (_, now, expected) => {
    const result = shouldShowOngoingMask(
      event,
      Temporal.PlainDateTime.from(now),
    );

    expect(result).toBe(expected);
  });
});
