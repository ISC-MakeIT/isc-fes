import { beforeEach, expect, it, vi } from "vitest";
import { createApiClient, uploadImage } from "@/shared/api";
import { updateStore } from "./update-store";
import { StoreCongestionLevel } from "../model/types";

vi.mock("@/shared/api", () => ({
  createApiClient: vi.fn(),
  uploadImage: vi.fn(),
}));

const patch = vi.fn();
const store = {
  id: "store-123",
  name: "テスト店舗",
  room: "501教室",
  description: "店舗の説明",
  imageUrl: "/store.png",
  reviewStatus: "approved",
  allergens: [],
  congestionLevel: 1,
  orderEnabled: true,
  closedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createApiClient).mockResolvedValue({
    PATCH: patch,
  } as unknown as Awaited<ReturnType<typeof createApiClient>>);
});

it.each<StoreCongestionLevel>([1, 2, 3])(
  "混雑度%sのみを送信し、他の店舗情報を上書きしない",
  async (congestionLevel) => {
    patch.mockResolvedValue({
      data: { ...store, congestionLevel },
      response: new Response(null, { status: 200 }),
    });

    const updated = await updateStore({
      storeId: store.id,
      input: { congestionLevel },
    });
    expect(patch).toHaveBeenCalledTimes(1);
    const [path, options] = patch.mock.calls[0]!;

    expect(path).toBe("/stores/{store_id}");
    expect(options.params.path).toEqual({ store_id: store.id });
    expect(JSON.parse(JSON.stringify(options.body))).toEqual({
      congestionLevel,
    });
    expect(uploadImage).not.toHaveBeenCalled();
    expect(updated.congestionLevel).toBe(congestionLevel);
    expect(updated.closedAt).toBeNull();
  },
);

it.each([
  [400, "入力内容に誤りがあります。内容をご確認ください。"],
  [401, "未ログインです。再度ログインしてからお試しください。"],
  [403, "この操作を行う権限がありません"],
  [404, "対象が見つかりません"],
  [500, "エラーが発生しました。時間を置いて再度試してください。"],
  [503, "エラーが発生しました。時間を置いて再度試してください。"],
])(
  "更新に失敗した場合はHTTP %sに対応する文言を返す",
  async (status, message) => {
    patch.mockResolvedValue({
      error: { message: "internal database details" },
      response: new Response(null, { status }),
    });

    await expect(
      updateStore({ storeId: store.id, input: { congestionLevel: 2 } }),
    ).rejects.toThrow(message);
  },
);
