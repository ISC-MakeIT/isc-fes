import { Temporal } from "temporal-polyfill-lite";
import { describe, expect, test } from "vitest";
import { getEventStatus } from "./get-event-status";

const event = {
  startAt: Temporal.PlainDateTime.from("2026-10-24T10:00"),
  endAt: Temporal.PlainDateTime.from("2026-10-24T11:00"),
};

describe("shouldShowOngoingMask", () => {
  test.each([
    ["イベント開始30分前", "2026-10-24T09:30:00", "upcoming"],
    ["イベント開始15分前", "2026-10-24T09:45:00", "startingSoon"],
    ["イベント開始時刻", "2026-10-24T10:00:00", "ongoing"],
    ["イベント開催中", "2026-10-24T10:30:00", "ongoing"],
    ["イベント終了時刻", "2026-10-24T11:00:00", "ended"],
    ["イベント終了後", "2026-10-24T11:00:01", "ended"],
  ])("%s（現在時刻: %s）の場合は%sを返す", (_, now, expected) => {
    const result = getEventStatus(event, Temporal.PlainDateTime.from(now));

    expect(result).toBe(expected);
  });
});
