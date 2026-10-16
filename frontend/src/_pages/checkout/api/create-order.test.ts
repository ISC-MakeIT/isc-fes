import { beforeEach, expect, it, vi } from "vitest";
import { createOrder } from "./create-order";
import { createApiClient } from "@/shared/api";
import { trackEvent } from "@/shared/lib/analytics";

vi.mock("@/shared/api", () => ({ createApiClient: vi.fn() }));
vi.mock("@/shared/lib/analytics", () => ({ trackEvent: vi.fn() }));

const post = vi.fn();
const input = { storeId: "store-123", expectedCartVersion: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createApiClient).mockResolvedValue({
    POST: post,
  } as unknown as Awaited<ReturnType<typeof createApiClient>>);
});

it("待機時間の拒否を計測し、サーバーの文言を既存のtoast用エラーとして返す", async () => {
  const message =
    "初回閲覧から3分は注文できません。もう少し時間を置いてから注文してください";
  post.mockResolvedValue({
    error: { code: "guest_order_too_early", message },
    response: new Response(null, { status: 403 }),
  });

  await expect(createOrder(input)).rejects.toThrow(message);
  expect(trackEvent).toHaveBeenCalledExactlyOnceWith("order_wait_blocked", {
    store_id: input.storeId,
  });
});

it.each([
  [403, undefined, "店舗は注文受付を停止しています"],
  [409, undefined, "カートが更新されています。再読み込みしてください"],
  [500, "guest_order_too_early", "サーバー内部でエラーが発生しました"],
])(
  "他の注文エラーは待機時間のイベントに含めない（%s）",
  async (status, code, message) => {
    post.mockResolvedValue({
      error: { code, message },
      response: new Response(null, { status }),
    });

    await expect(createOrder(input)).rejects.toThrow();
    expect(trackEvent).not.toHaveBeenCalled();
  },
);
