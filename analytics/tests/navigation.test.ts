import { describe, expect, test } from "bun:test";
import { legacyAnalysisHref, pageQuery } from "../src/lib/navigation";

describe("Legacy analytics links", () => {
  test("old views go to the matching report without losing encoded dates or conditions", () => {
    for (const [view, path] of Object.entries({
      overview: "/overview",
      sales: "/stores",
      orders: "/stores",
      congestion: "/advanced",
      explorer: "/advanced",
    })) {
      const params = pageQuery({
        view,
        start: "2026-10-24T10:00:00+09:00",
        end: "2026-10-25T00:00:00+09:00",
        interval: "15m",
        store: "store-id",
        menu: "menu-id",
        sales: "accepted",
      });
      const target = new URL(legacyAnalysisHref(params)!, "http://localhost");
      expect(target.pathname).toBe(path);
      expect(target.searchParams.get("start")).toBe(params.get("start"));
      expect(target.searchParams.get("store")).toBe("store-id");
      expect(target.searchParams.get("menu")).toBe("menu-id");
      expect(target.searchParams.get("sales")).toBe("accepted");
      expect(target.searchParams.get("view")).toBe(path === "/advanced" ? view : null);
      expect(params.get("view")).toBe(view);
    }
  });
  test("home and unknown view parameters do not trigger redirects, and repeated query values survive", () => {
    expect(legacyAnalysisHref(new URLSearchParams())).toBeNull();
    expect(legacyAnalysisHref(new URLSearchParams({ view: "unknown" }))).toBeNull();
    expect(legacyAnalysisHref(new URLSearchParams({ view: "__proto__" }))).toBeNull();
    const params = pageQuery({
      view: "sales",
      label: ["お店 & ゲスト", "a+b"],
      missing: undefined,
    });
    const target = new URL(legacyAnalysisHref(params)!, "http://localhost");
    expect(target.searchParams.getAll("label")).toEqual(["お店 & ゲスト", "a+b"]);
    expect(target.searchParams.has("missing")).toBe(false);
  });
});
