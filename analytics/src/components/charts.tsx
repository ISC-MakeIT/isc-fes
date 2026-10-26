"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsData, MetricRow } from "@/lib/types";
import { integer, minutes, percent, shortDate, yen } from "@/lib/format";

export const colors = [
  "#267b57",
  "#e8b865",
  "#81a9ba",
  "#b9b0cf",
  "#cc8c78",
  "#87a778",
  "#6e85b2",
  "#bf9b5d",
];
const grid = { stroke: "#edf0ec", strokeDasharray: "3 4", vertical: false };
const axis = {
  axisLine: false as const,
  tickLine: false as const,
  tick: { fill: "#8a938d", fontSize: 11 },
  tickMargin: 12,
};
const tooltipStyle = {
  border: "1px solid #e6ebe5",
  borderRadius: 10,
  boxShadow: "0 6px 24px #243a3010",
  fontSize: 12,
};
export type MetricKey =
  | "orders"
  | "revenue"
  | "units"
  | "cancellationRate"
  | "faceRate"
  | "averageAmount"
  | "averageMinutes"
  | "medianMinutes"
  | "p90Minutes"
  | "preparationMinutes"
  | "preparationMedianMinutes"
  | "preparationP90Minutes"
  | "pickupMinutes"
  | "pickupMedianMinutes"
  | "pickupP90Minutes";
export const metricOptions: {
  key: MetricKey;
  label: string;
  format: (n: number | null) => string;
}[] = [
  { key: "orders", label: "注文数", format: (n) => (n == null ? "—" : `${integer(n)}件`) },
  { key: "revenue", label: "売上", format: (n) => yen(n ?? 0) },
  { key: "units", label: "販売点数", format: (n) => `${integer(n ?? 0)}点` },
  { key: "cancellationRate", label: "キャンセル率", format: percent },
  { key: "faceRate", label: "対面受付率（推定）", format: percent },
  { key: "averageAmount", label: "平均注文単価", format: (n) => (n == null ? "—" : yen(n)) },
  { key: "averageMinutes", label: "平均完了時間", format: minutes },
  { key: "medianMinutes", label: "完了時間の中央値", format: minutes },
  { key: "p90Minutes", label: "完了時間のP90", format: minutes },
  { key: "preparationMinutes", label: "平均調理時間", format: minutes },
  { key: "preparationMedianMinutes", label: "調理時間の中央値", format: minutes },
  { key: "preparationP90Minutes", label: "調理時間のP90", format: minutes },
  { key: "pickupMinutes", label: "平均受取待ち時間", format: minutes },
  { key: "pickupMedianMinutes", label: "受取待ち時間の中央値", format: minutes },
  { key: "pickupP90Minutes", label: "受取待ち時間のP90", format: minutes },
];
const tickNumber = (value: number) =>
  value >= 10000 ? `${integer(value / 1000)}k` : integer(value);
export function SimpleChart({
  data,
  metric = "orders",
  kind = "bar",
}: {
  data: (MetricRow | { name: string; orders: number })[];
  metric?: MetricKey;
  kind?: "bar" | "line" | "area";
}) {
  const info = metricOptions.find((m) => m.key === metric)!;
  const children = (
    <>
      <CartesianGrid {...grid} />
      <XAxis {...axis} dataKey="name" minTickGap={30} />
      <YAxis {...axis} tickFormatter={tickNumber} />
      <Tooltip
        contentStyle={tooltipStyle}
        formatter={(v) => info.format(v == null ? null : Number(v))}
      />
    </>
  );
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "line" ? (
          <LineChart data={data} margin={{ left: -12, top: 12, right: 15 }}>
            {children}
            <Line
              dataKey={metric}
              name={info.label}
              stroke={colors[0]}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        ) : kind === "area" ? (
          <AreaChart data={data} margin={{ left: -12, top: 12, right: 15 }}>
            {children}
            <Area
              dataKey={metric}
              name={info.label}
              stroke={colors[0]}
              fill="#e6efe5"
              strokeWidth={2}
            />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ left: -12, top: 12, right: 15 }}>
            {children}
            <Bar
              dataKey={metric}
              name={info.label}
              fill={colors[0]}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
export function CongestionChart({ data }: { data: AnalyticsData }) {
  const [selected, setSelected] = useState("");
  const stores = Array.from(new Map(data.congestion.map((r) => [r.storeId, r.storeName])));
  const selectedId = stores.some(([id]) => id === selected) ? selected : stores[0]?.[0];
  const samples = data.congestion
    .filter((r) => r.storeId === selectedId)
    .map((r) => ({ ...r, name: shortDate(r.at) }));
  return (
    <>
      <div className="chart-controls">
        <label>
          表示する店舗
          <select value={selectedId ?? ""} onChange={(e) => setSelected(e.target.value)}>
            {stores.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">区間終了直前・進行中は集計時点の状態</span>
      </div>
      <div className="chart large-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={samples} margin={{ left: -18, right: 8, top: 10 }}>
            <CartesianGrid {...grid} />
            <XAxis {...axis} dataKey="name" minTickGap={45} />
            <YAxis {...axis} domain={[1, 3]} ticks={[1, 2, 3]} />
            <YAxis {...axis} yAxisId="queue" orientation="right" allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: 11, paddingTop: 15 }}
            />
            <Bar
              yAxisId="queue"
              dataKey={data.filters.congestionMetric}
              name="推定に使用した注文数（右軸）"
              fill="#e7ece3"
              maxBarSize={25}
            />
            <Line
              type="stepAfter"
              dataKey="reported"
              name="入力された混雑度"
              stroke="#267b57"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="stepAfter"
              dataKey="inferred"
              name="推定混雑度"
              stroke="#c58e42"
              strokeWidth={2.5}
              strokeDasharray="5 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
export function StoreComparison({ data, metric }: { data: AnalyticsData; metric: MetricKey }) {
  const info = metricOptions.find((m) => m.key === metric)!;
  const top = [...data.stores].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0)).slice(0, 8);
  const lookup = new Map(data.storeTimeline.map((row) => [`${row.key}:${row.storeId}`, row]));
  const rows = data.timeline.map((t) =>
    Object.fromEntries([
      ["name", t.name],
      ...top.map((s) => [
        s.key,
        lookup.get(`${t.key}:${s.key}`)?.[metric] ??
          (["orders", "revenue", "units"].includes(metric) ? 0 : null),
      ]),
    ]),
  );
  return (
    <>
      <p className="muted chart-note">
        選択指標の上位8店舗を比較。注文のない区間の率・時間は欠測として表示します。
      </p>
      <div className="chart large-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: -12, right: 15, top: 12 }}>
            <CartesianGrid {...grid} />
            <XAxis {...axis} dataKey="name" minTickGap={45} />
            <YAxis {...axis} tickFormatter={tickNumber} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => info.format(v == null ? null : Number(v))}
            />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: 11, paddingTop: 15 }}
            />
            {top.map((s, i) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.name}
                type="monotone"
                stroke={colors[i]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
