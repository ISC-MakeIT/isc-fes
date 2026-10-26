import { defaultFilters, jstTimestamp, parseFilters } from "./filters";
import type { Metadata, OverviewData, OverviewFilters } from "./types";

export const overviewSalesLabels = {
  completed: "受取完了のみ",
  accepted: "キャンセルを除く",
  all: "全注文（キャンセルを含む）",
};
export function parseOverviewFilters(params: URLSearchParams): OverviewFilters {
  // Store, channel and status filters must not silently narrow the overall totals.
  const shared = parseFilters(
    new URLSearchParams({
      start: params.get("start") ?? "",
      end: params.get("end") ?? "",
      interval: params.get("interval") ?? "30m",
      sales: params.get("sales") ?? "completed",
    }),
  );
  return { start: shared.start, end: shared.end, interval: shared.interval, sales: shared.sales };
}
export function overviewDefaults(meta: Metadata): OverviewFilters {
  const base = defaultFilters(meta.firstOrder, meta.lastOrder);
  return { start: base.start, end: base.end, interval: base.interval, sales: base.sales };
}
export function overviewCSV(data: OverviewData): (string | number | null)[][] {
  return [
    [
      "名前",
      "集計時点JST",
      "累計売上（円）",
      "累計注文件数（件）",
      "累計キャンセル率（%）",
      "累計対面受付率（%）",
      "累計キャンセル件数（件）",
      "累計対面受付件数（件）",
      "累計売上対象注文件数（件）",
      "累計受取完了件数（件）",
      "区間開始JST",
      "区間終了JST",
      "集計間隔",
      "期間開始JST",
      "期間終了JST",
      "売上の対象",
      "集計時刻JST",
    ],
    ...data.timeline.map((r) => [
      jstTimestamp(r.key),
      jstTimestamp(r.key),
      r.revenue,
      r.orders,
      r.cancellationRate,
      r.faceRate,
      r.cancelled,
      r.face,
      r.salesOrders,
      r.completed,
      jstTimestamp(r.bucketStart),
      jstTimestamp(r.key),
      data.filters.interval,
      jstTimestamp(data.filters.start),
      jstTimestamp(data.filters.end),
      overviewSalesLabels[data.filters.sales],
      jstTimestamp(data.generatedAt),
    ]),
  ];
}
