import { beforeEach, expect, it, vi } from "vitest";
import { createApiClient } from "@/shared/api";
import { ensureGuest } from "./ensure-guest";

vi.mock("@/shared/api", () => ({ createApiClient: vi.fn() }));

const post = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createApiClient).mockResolvedValue({
    POST: post,
  } as unknown as Awaited<ReturnType<typeof createApiClient>>);
});

it("同時の発行要求をまとめ、完了後の再訪問では再び確認する", async () => {
  post.mockResolvedValue({ response: new Response(null, { status: 204 }) });

  const first = ensureGuest();
  const second = ensureGuest();
  expect(second).toBe(first);
  await Promise.all([first, second]);
  expect(post).toHaveBeenCalledExactlyOnceWith("/guests");

  await ensureGuest();
  expect(post).toHaveBeenCalledTimes(2);
});

it("通信に失敗しても再度発行できる", async () => {
  post.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await expect(ensureGuest()).rejects.toThrow("Failed to fetch");

  post.mockResolvedValue({ response: new Response(null, { status: 204 }) });
  await expect(ensureGuest()).resolves.toBeUndefined();
  expect(post).toHaveBeenCalledTimes(2);
});
