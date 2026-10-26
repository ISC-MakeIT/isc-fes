import type { AnalyticsData, ChartPoint, Metrics } from "./types";
import { jstInput, jstTimestamp } from "./filters";

const zeroMetrics: (keyof Metrics)[] = [
  "orders",
  "revenue",
  "units",
  "guests",
  "completed",
  "cancelled",
  "face",
  "preparationSamples",
  "pickupSamples",
];
export function storeChartPoints(
  data: AnalyticsData,
  metric: keyof Metrics,
  statistic?: "average" | "median" | "both",
  medianMetric?: keyof Metrics,
): ChartPoint[] {
  const lookup = new Map(data.storeTimeline.map((row) => [`${row.key}:${row.storeId}`, row]));
  const sameNames = new Map<string, number>();
  data.stores.forEach((s) => sameNames.set(s.name, (sameNames.get(s.name) ?? 0) + 1));
  const points: ChartPoint[] = [];
  for (const at of data.timeline)
    for (const store of data.stores) {
      const row = lookup.get(`${at.key}:${store.key}`);
      const name =
        (sameNames.get(store.name) ?? 0) > 1
          ? `${store.name} (${store.key.slice(-6)})`
          : store.name;
      const variants =
        statistic === "both" && medianMetric
          ? ([
              [metric, "平均"],
              [medianMetric, "中央値"],
            ] as const)
          : ([
              [
                statistic === "median" && medianMetric ? medianMetric : metric,
                statistic === "median" ? "中央値" : "平均",
              ],
            ] as const);
      for (const [key, label] of variants) {
        const samples = key.startsWith("preparation")
          ? row?.preparationSamples
          : key.startsWith("pickup")
            ? row?.pickupSamples
            : ["averageMinutes", "medianMinutes"].includes(key)
              ? row?.completed
              : key.startsWith("cancellation")
                ? row?.cancelled
                : key === "averageAmount" || key === "medianAmount"
                  ? row?.salesOrders
                  : row?.orders;
        points.push({
          key: at.key,
          label: at.name,
          seriesId: `${store.key}:${key}`,
          series: statistic ? `${name} / ${label}` : name,
          value: row?.[key] ?? (zeroMetrics.includes(key) ? 0 : null),
          samples: samples ?? 0,
        });
      }
    }
  return points;
}
export function menuChartPoints(
  data: AnalyticsData,
  metric: "revenue" | "units",
  selected: string[],
): ChartPoint[] {
  const menus = data.menus.filter((m) => selected.includes(m.key));
  const names = new Map<string, number>();
  menus.forEach((m) => names.set(m.name, (names.get(m.name) ?? 0) + 1));
  const lookup = new Map(data.menuTimeline.map((r) => [`${r.key}:${r.menuId}`, r]));
  return data.timeline.flatMap((t) =>
    menus.map((m) => {
      const row = lookup.get(`${t.key}:${m.key}`);
      return {
        key: t.key,
        label: t.name,
        seriesId: m.key,
        series: (names.get(m.name) ?? 0) > 1 ? `${m.name} (${m.key.slice(-6)})` : m.name,
        value: row?.[metric] ?? 0,
        samples: row?.salesOrders ?? 0,
      };
    }),
  );
}
export function chartRows(points: ChartPoint[]) {
  const series = [...new Map(points.map((p) => [p.seriesId, p.series])).entries()];
  const rows = new Map<string, Record<string, string | number | null>>();
  for (const point of points) {
    const row = rows.get(point.key) ?? { key: point.key, label: point.label };
    row[point.seriesId] = point.value;
    rows.set(point.key, row);
  }
  return { series, rows: [...rows.values()] };
}
export interface ExportContext {
  start: string;
  end: string;
  interval: string;
  generatedAt: string;
  conditions: string;
}
export function notionChartRows(
  points: ChartPoint[],
  metric: string,
  unit: string,
  context: ExportContext,
): (string | number | null)[][] {
  return [
    [
      "名前",
      "日時ラベルJST",
      "系列",
      "指標",
      "値",
      "単位",
      "対象件数",
      "集計間隔",
      "期間開始JST",
      "期間終了JST",
      "集計条件",
      "集計時刻JST",
    ],
    ...points.map((p) => {
      const label = /^\d{4}-\d{2}-\d{2}T/.test(p.key)
        ? jstTimestamp(p.key)
        : /^\d{4}-\d{2}-\d{2}$/.test(p.key)
          ? `${p.key} 00:00`
          : p.label;
      return [
        `${label} / ${p.series} / ${metric}`,
        label,
        p.series,
        metric,
        p.value,
        unit,
        p.samples,
        context.interval,
        jstInput(context.start).replace("T", " "),
        jstInput(context.end).replace("T", " "),
        context.conditions,
        jstInput(context.generatedAt).replace("T", " "),
      ];
    }),
  ];
}
export function dailyPoints<T extends { key: string; name: string }>(
  rows: T[],
  series: {
    id: string;
    label: string;
    value: (row: T) => number | null;
    samples?: (row: T) => number | null;
  }[],
): ChartPoint[] {
  return rows.flatMap((row) =>
    series.map((s) => ({
      key: row.key,
      label: row.name,
      seriesId: s.id,
      series: s.label,
      value: s.value(row),
      samples: s.samples?.(row) ?? null,
    })),
  );
}
