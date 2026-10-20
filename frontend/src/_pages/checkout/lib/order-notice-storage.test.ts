import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  hasConfirmedOrderNotice,
  storeOrderNoticeConfirmation,
} from "./order-notice-storage";

const storedValues = new Map<string, string>();
const getItem = vi.fn((key: string) => storedValues.get(key) ?? null);
const setItem = vi.fn((key: string, value: string) => {
  storedValues.set(key, value);
});

beforeEach(() => {
  storedValues.clear();
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", { getItem, setItem });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("記録がない場合は未確認として扱う", () => {
  expect(hasConfirmedOrderNotice()).toBe(false);
});

it("確認済みの記録を保存し、次回の読み取りでも確認済みとして扱う", () => {
  expect(storeOrderNoticeConfirmation()).toBe(true);
  expect(hasConfirmedOrderNotice()).toBe(true);
  expect(hasConfirmedOrderNotice()).toBe(true);
});

it.each(["false", "", "invalid"])(
  "確認済み以外の保存値 %j では確認を省略しない",
  (value) => {
    getItem.mockReturnValueOnce(value);
    expect(hasConfirmedOrderNotice()).toBe(false);
  },
);

it("ストレージを読み取れない場合は確認を表示する", () => {
  getItem.mockImplementationOnce(() => {
    throw new DOMException("Storage is blocked", "SecurityError");
  });

  expect(hasConfirmedOrderNotice()).toBe(false);
});

it("保存できない場合も例外を投げず、次回は確認を表示する", () => {
  setItem.mockImplementationOnce(() => {
    throw new DOMException("Storage is full", "QuotaExceededError");
  });

  expect(storeOrderNoticeConfirmation()).toBe(false);
  expect(hasConfirmedOrderNotice()).toBe(false);
});
