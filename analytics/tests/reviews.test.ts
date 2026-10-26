import { describe, expect, test } from "bun:test";
import {
  parseReviewFilters,
  reviewTriggerDefinitions,
  reviewTriggerName,
  reviewDefaults,
  reviewCommentCSV,
} from "../src/lib/reviews";
import { reportParams } from "../src/lib/report-filters";
import {
  QUESTIONNAIRE_AUDIENCE_BY_TRIGGER,
  AudienceTarget,
} from "../../frontend/src/widgets/app-questionnaire/config/questionnaire";
import type { Metadata, ReviewComment } from "../src/lib/types";
describe("Review classification and validation", () => {
  const params = () =>
    new URLSearchParams({
      start: "2026-10-24T10:00:00+09:00",
      end: "2026-10-24T12:00:00+09:00",
      interval: "30m",
    });
  test("known trigger mapping stays aligned with the frontend questionnaire, with no prefix guessing", () => {
    expect(Object.keys(reviewTriggerDefinitions).sort()).toEqual(
      Object.keys(QUESTIONNAIRE_AUDIENCE_BY_TRIGGER).sort(),
    );
    for (const [key, value] of Object.entries(QUESTIONNAIRE_AUDIENCE_BY_TRIGGER))
      expect(reviewTriggerDefinitions[key as keyof typeof reviewTriggerDefinitions].audience).toBe(
        value === AudienceTarget.Guest ? "guest" : "store",
      );
    expect(reviewTriggerName("new_future_trigger")).toBe("new_future_trigger");
    expect(reviewTriggerName(null)).toBe("未設定");
  });
  test("one Notion CSV preserves individual ratings from both audiences and unclassified reviews", () => {
    const shared = {
      createdAt: "2026-10-24T01:00:00.000Z",
      createdLabel: "2026-10-24 10:00:00",
    };
    const reviews: ReviewComment[] = [
      {
        ...shared,
        key: "guest-review",
        audience: "guest",
        rating: 5,
        trigger: "order_completed",
        comment: '簡単！\n"また使いたい"',
      },
      {
        ...shared,
        key: "store-review",
        audience: "store",
        rating: 2,
        trigger: "menu_updated",
        comment: null,
      },
      {
        ...shared,
        key: "unknown-review",
        audience: "unknown",
        rating: 3,
        trigger: null,
        comment: "区分不明",
      },
    ];
    const [header, ...rows] = reviewCommentCSV(reviews);
    expect(header).toEqual([
      "名前",
      "レビュー元",
      "rating",
      "投稿日時JST",
      "trigger",
      "きっかけ",
      "コメント",
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.length === header.length)).toBe(true);
    expect(rows.map((r) => r[1])).toEqual(["ゲスト側", "店舗側", "不明"]);
    expect(rows.map((r) => r[2])).toEqual([5, 2, 3]);
    expect(rows.every((r) => typeof r[2] === "number")).toBe(true);
    expect(rows.map((r) => r[3])).toEqual(reviews.map((r) => r.createdLabel));
    expect(rows.map((r) => r[6])).toEqual(reviews.map((r) => r.comment));
    expect(rows[2][4]).toBeNull();
    expect(rows[2][5]).toBe("未設定");
    expect(rows.every((r) => typeof r[0] === "string" && r[0].length > 0)).toBe(true);
    expect(reviewCommentCSV([])).toEqual([header]);
  });
  test("review defaults use review dates and ignore unrelated store/order filters", () => {
    const meta = {
      firstReview: "2026-10-23T10:00:00+09:00",
      lastReview: "2026-10-24T10:00:00+09:00",
    } as Metadata;
    const f = reviewDefaults(meta);
    expect(f.start).toBe("2026-10-23T00:00:00+09:00");
    expect(f.audience).toBe("all");
    expect(f.ratingMin).toBe(1);
    expect(f.ratingMax).toBe(5);
    const p = params();
    p.set("store", "invalid");
    p.set("status", "cancelled");
    p.set("channel", "face");
    expect(parseReviewFilters(p).audience).toBe("all");
    expect(parseReviewFilters(reportParams(f))).toEqual(f);
  });
  test("validates bounds, enums, page size and search length while preserving arbitrary literal trigger strings", () => {
    for (const [key, value] of [
      ["audience", "staff"],
      ["comment", "any"],
      ["ratingMin", "0"],
      ["ratingMax", "6"],
      ["ratingMin", "4.5"],
      ["page", "-1"],
      ["page", "100001"],
      ["search", "x".repeat(201)],
      ["trigger", "x".repeat(101)],
      ["missingTrigger", "yes"],
    ] as const) {
      const p = params();
      p.set(key, value);
      expect(() => parseReviewFilters(p)).toThrow();
    }
    const p = params();
    p.set("ratingMin", "5");
    p.set("ratingMax", "1");
    expect(() => parseReviewFilters(p)).toThrow();
    const m = params();
    m.set("missingTrigger", "true");
    m.set("trigger", "order_completed");
    expect(() => parseReviewFilters(m)).toThrow();
    const raw = params();
    raw.set("trigger", "' OR 1=1 --");
    raw.set("search", "100%_");
    expect(parseReviewFilters(raw).trigger).toBe("' OR 1=1 --");
  });
});
