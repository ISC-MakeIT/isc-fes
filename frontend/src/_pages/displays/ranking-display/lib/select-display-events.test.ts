import type { ScheduledEvent } from "@/entities/event";
import { Temporal } from "temporal-polyfill-lite";
import { describe, expect, test } from "vitest";
import { selectDisplayEvents } from "./select-display-events";

function event(name: string, startAt: string, endAt: string): ScheduledEvent {
  return {
    name,
    startAt: Temporal.PlainDateTime.from(startAt),
    endAt: Temporal.PlainDateTime.from(endAt),
    room: "8Fステージ",
    bannerSrc: undefined,
    description: "",
  };
}

const morning = event("午前", "2026-10-24T10:00", "2026-10-24T11:00");
const overlapping = event("同時開催", "2026-10-24T10:30", "2026-10-24T12:00");
const nextDay = event("翌日", "2026-10-25T10:00", "2026-10-25T11:00");
const events = [nextDay, overlapping, morning];

describe("selectDisplayEvents", () => {
  test("開始時刻ちょうどに開催中へ切り替わる", () => {
    expect(
      selectDisplayEvents(
        events,
        Temporal.PlainDateTime.from("2026-10-24T10:00"),
      ),
    ).toEqual({ current: morning, next: overlapping });
  });

  test("開催前は、入力順によらず最も早いイベントをNEXTにする", () => {
    expect(
      selectDisplayEvents(
        events,
        Temporal.PlainDateTime.from("2026-10-24T09:00"),
      ),
    ).toEqual({ current: undefined, next: morning });
  });

  test("開始時刻を含み、同時開催では先に始まったイベントを表示する", () => {
    expect(
      selectDisplayEvents(
        events,
        Temporal.PlainDateTime.from("2026-10-24T10:30"),
      ),
    ).toEqual({ current: morning, next: nextDay });
  });

  test("終了時刻に到達したイベントは開催中から外す", () => {
    expect(
      selectDisplayEvents(
        events,
        Temporal.PlainDateTime.from("2026-10-24T11:00"),
      ),
    ).toEqual({ current: overlapping, next: nextDay });
  });

  test("イベント間は開催中を空にして翌日の予定を表示する", () => {
    expect(
      selectDisplayEvents(
        events,
        Temporal.PlainDateTime.from("2026-10-24T12:00"),
      ),
    ).toEqual({ current: undefined, next: nextDay });
  });

  test("全イベント終了後と予定なしの場合は、どちらも空にする", () => {
    const now = Temporal.PlainDateTime.from("2026-10-25T11:00");
    expect(selectDisplayEvents(events, now)).toEqual({
      current: undefined,
      next: undefined,
    });
    expect(selectDisplayEvents([], now)).toEqual({
      current: undefined,
      next: undefined,
    });
  });

  test("元の予定配列を並び替えない", () => {
    const original = [...events];
    selectDisplayEvents(
      events,
      Temporal.PlainDateTime.from("2026-10-24T09:00"),
    );
    expect(events).toEqual(original);
  });
});
