import { OrderStatus } from "@/entities/order";
import { describe, expect, test } from "vitest";
import { canCancelOrder } from "./can-cancel-order";
import { Temporal } from "temporal-polyfill-lite";

describe("canCancelOrder", () => {
  const readyAt = new Date("2026-01-01T00:00:00Z");

  test.each([
    ["15分直前", "2026-01-01T00:14:59.99999Z", false],
    ["15分ちょうど", "2026-01-01T00:15:00Z", true],
    ["15分経過後", "2026-01-02T00:00:00Z", true],
  ])("%s", (_, now, expected) => {
    const order = {
      status: OrderStatus.Ready,
      readyAt,
    };

    const result = canCancelOrder(order, Temporal.Instant.from(now));

    expect(result).toBe(expected);
  });

  test("readyAtがnullならキャンセルできない", () => {
    const order = {
      status: OrderStatus.Ready,
      readyAt: null,
    };

    const now = Temporal.Instant.from("2026-01-02T00:00:00Z");

    expect(canCancelOrder(order, now)).toBe(false);
  });

  test.each([
    OrderStatus.Pending,
    OrderStatus.Completed,
    OrderStatus.Cancelled,
  ])("ステータスが%sならキャンセルできない", (status) => {
    const order = { status, readyAt };

    const now = Temporal.Instant.from("2026-01-02T00:00:00Z");

    expect(canCancelOrder(order, now)).toBe(false);
  });
});
