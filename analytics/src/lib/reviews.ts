import type { ReviewAudience, ReviewComment, ReviewFilters } from "./types";
import { defaultFilters, InputError, parseFilters } from "./filters";
import type { Metadata } from "./types";

// Matches QUESTIONNAIRE_AUDIENCE_BY_TRIGGER in the frontend questionnaire configuration.
// IDs are optional and can coexist, so they must never determine the audience.
export const reviewTriggerDefinitions = {
  cart_item_added: { name: "カートへ追加", audience: "guest" },
  order_completed: { name: "注文手続き完了", audience: "guest" },
  pickup_completed: { name: "受け取り完了", audience: "guest" },
  store_home_opened: { name: "店舗ホームを表示", audience: "store" },
  menu_created: { name: "メニュー作成", audience: "store" },
  menu_updated: { name: "メニュー更新", audience: "store" },
  menu_deleted: { name: "メニュー削除", audience: "store" },
  topping_created: { name: "トッピング作成", audience: "store" },
  topping_updated: { name: "トッピング更新", audience: "store" },
  topping_deleted: { name: "トッピング削除", audience: "store" },
} as const satisfies Record<string, { name: string; audience: ReviewAudience }>;
export const reviewAudienceLabels = { guest: "ゲスト側", store: "店舗側", unknown: "不明" };
export function reviewTriggerName(trigger: string | null) {
  if (!trigger) return "未設定";
  return (
    reviewTriggerDefinitions[trigger as keyof typeof reviewTriggerDefinitions]?.name ?? trigger
  );
}
export function parseReviewFilters(params: URLSearchParams): ReviewFilters {
  const shared = parseFilters(
    new URLSearchParams({
      start: params.get("start") ?? "",
      end: params.get("end") ?? "",
      interval: params.get("interval") ?? "30m",
    }),
  );
  const audience = params.get("audience") ?? "all";
  const comment = params.get("comment") ?? "all";
  const missing = params.get("missingTrigger") ?? "false";
  const trigger = (params.get("trigger") ?? "").trim();
  const search = (params.get("search") ?? "").trim();
  const min = params.get("ratingMin") ?? "1";
  const max = params.get("ratingMax") ?? "5";
  const page = params.get("page") ?? "0";
  if (!["all", "guest", "store", "unknown"].includes(audience))
    throw new InputError("レビューの対象区分が不正です。");
  if (!["all", "with", "without"].includes(comment))
    throw new InputError("コメントの条件が不正です。");
  if (!["true", "false"].includes(missing) || (missing === "true" && trigger))
    throw new InputError("triggerの条件が不正です。");
  if (
    [...trigger].length > 100 ||
    [...search].length > 200 ||
    trigger.includes("\0") ||
    search.includes("\0")
  )
    throw new InputError("triggerは100文字、コメント検索は200文字以内で指定してください。");
  if (!/^[1-5]$/.test(min) || !/^[1-5]$/.test(max) || Number(min) > Number(max))
    throw new InputError("ratingは1〜5の範囲で、下限以下にならない上限を指定してください。");
  if (!/^\d+$/.test(page) || Number(page) > 100000) throw new InputError("ページ番号が不正です。");
  return {
    start: shared.start,
    end: shared.end,
    interval: shared.interval,
    audience: audience as ReviewFilters["audience"],
    trigger,
    missingTrigger: missing === "true",
    ratingMin: Number(min),
    ratingMax: Number(max),
    comment: comment as ReviewFilters["comment"],
    search,
    page: Number(page),
  };
}
export function reviewDefaults(meta: Metadata): ReviewFilters {
  const base = defaultFilters(
    meta.firstReview ?? meta.firstOrder,
    meta.lastReview ?? meta.lastOrder,
  );
  return parseReviewFilters(
    new URLSearchParams({ start: base.start, end: base.end, interval: base.interval }),
  );
}
export function reviewCommentCSV(rows: ReviewComment[]): (string | number | null)[][] {
  return [
    ["名前", "レビュー元", "rating", "投稿日時JST", "trigger", "きっかけ", "コメント"],
    ...rows.map((r) => [
      `${r.createdLabel} ${reviewAudienceLabels[r.audience]} ★${r.rating}`,
      reviewAudienceLabels[r.audience],
      r.rating,
      r.createdLabel,
      r.trigger,
      reviewTriggerName(r.trigger),
      r.comment,
    ]),
  ];
}
