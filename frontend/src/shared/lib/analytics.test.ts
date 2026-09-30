import { describe, expect, it } from "vitest";
import {
  analyticsArea,
  analyticsEventPayload,
  analyticsLocation,
  analyticsPath,
  analyticsReferrer,
} from "./analytics";

describe("GA4 に送る URL", () => {
  it("店舗とメニューの ID を画面名に置き換える", () => {
    expect(analyticsPath("/stores/store-123/menus/menu-456")).toBe(
      "/stores/:storeId/menus/:menuId",
    );
    expect(analyticsPath("/member/stores/store-123/menus")).toBe(
      "/member/stores/:storeId/menus",
    );
    expect(analyticsPath("/invites/secret-token")).toBe("/other");
  });

  it("ログイン先などのクエリを破棄し、安全な UTM のみ残す", () => {
    expect(
      analyticsLocation(
        "https://fes.example/login?redirect_to=%2Finvites%2Fsecret&utm_source=poster&utm_campaign=2026-fes&utm_content=user%40example.com",
      ),
    ).toBe("https://fes.example/login?utm_source=poster&utm_campaign=2026-fes");
  });

  it("参照元の内部 URL と外部 URL を匿名化する", () => {
    expect(
      analyticsReferrer(
        "https://fes.example/invites/secret-token?code=secret",
        "https://fes.example",
      ),
    ).toBe("https://fes.example/other");
    expect(
      analyticsReferrer(
        "https://social.example/post/private-id?email=user@example.com",
        "https://fes.example",
      ),
    ).toBe("https://social.example");
  });

  it("画面エリアを区別する", () => {
    expect(analyticsArea("/stores/store-123")).toBe("guest");
    expect(analyticsArea("/member/stores/store-123")).toBe("member");
    expect(analyticsArea("/admin/store-applications")).toBe("admin");
  });

  it("操作イベントにも匿名化した URL とエリアを付ける", () => {
    expect(
      analyticsEventPayload(
        { store_id: "store-123" },
        "https://fes.example/member/stores/store-123?redirect_to=/invites/secret",
        true,
      ),
    ).toEqual({
      store_id: "store-123",
      app_area: "member",
      page_location: "https://fes.example/member/stores/:storeId",
      debug_mode: true,
    });
  });
});
