"use client";
import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint } from "@/lib/types";
import { chartRows, type ExportContext } from "@/lib/chart-data";
import { decimal, integer, yen } from "@/lib/format";
import { ChartExport, Panel } from "./shared";

const palette = [
  "#267b57",
  "#c49142",
  "#6b91ad",
  "#a38bb7",
  "#d18571",
  "#84a668",
  "#568d89",
  "#bd8b9c",
  "#7586bc",
  "#9b9f5e",
  "#a37246",
  "#68836b",
  "#467ab1",
  "#b85a6b",
  "#8e672b",
  "#6971a8",
  "#6c9896",
  "#a47f68",
  "#899c4e",
  "#aa6e91",
  "#4e9a70",
  "#b39d4b",
  "#527f85",
  "#a49bbf",
];
export function SeriesChart({
  title,
  note,
  points,
  unit,
  context,
  disabled,
  controls,
  kind = "line",
  cumulative = false,
}: {
  title: string;
  note: string;
  points: ChartPoint[];
  unit: string;
  context: ExportContext;
  disabled: boolean;
  controls?: ReactNode;
  kind?: "line" | "bar";
  cumulative?: boolean;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const { series, rows } = chartRows(points);
  const bases = [...new Set(series.map(([key]) => key.split(":")[0]))];
  const color = (key: string) => palette[bases.indexOf(key.split(":")[0]) % palette.length];
  const exportPoints = points.filter((p) => !hidden.includes(p.seriesId));
  const format = (v: number | null) =>
    v == null
      ? "—"
      : unit === "円"
        ? yen(v)
        : unit === "評価"
          ? `${decimal(v, 2)} / 5`
          : `${["分", "%"].includes(unit) ? decimal(v) : integer(v)}${unit}`;
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="#edf0e9" strokeDasharray="3 4" />
      <XAxis
        dataKey="label"
        axisLine={false}
        tickLine={false}
        minTickGap={26}
        tick={{ fill: "#8a9385", fontSize: 10 }}
        tickMargin={10}
      />
      <YAxis
        axisLine={false}
        tickLine={false}
        allowDecimals={["円", "分", "%", "評価"].includes(unit)}
        domain={unit === "評価" ? [1, 5] : undefined}
        tick={{ fill: "#8a9385", fontSize: 10 }}
        width={52}
        tickFormatter={(v) => (Number(v) >= 10000 ? `${Number(v) / 1000}k` : String(v))}
      />
      <Tooltip
        contentStyle={{ borderRadius: 9, border: "1px solid #e4eadc", fontSize: 11 }}
        formatter={(value) => format(value == null ? null : Number(value))}
      />
    </>
  );
  const lines = series.map(([key, name]) => {
    const first = rows.findIndex((row) => row[key] != null);
    const last = rows.findLastIndex((row) => row[key] != null);
    // Keep the endpoints of dense cumulative curves, including a one-point series.
    // Thousands of redundant SVG circles otherwise make filter changes sluggish.
    const endpointDot = ({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) =>
      index === first || index === last ? (
        <circle cx={cx} cy={cy} r={2} fill={color(key)} />
      ) : (
        <></>
      );
    return (
      <Line
        key={key}
        dataKey={key}
        name={name}
        type="linear"
        stroke={color(key)}
        strokeWidth={2}
        strokeDasharray={name.endsWith("中央値") ? "5 3" : undefined}
        dot={
          cumulative && points.length > 1000
            ? endpointDot
            : { r: 2, strokeWidth: 0, fill: color(key) }
        }
        activeDot={{ r: 3 }}
        hide={hidden.includes(key)}
        isAnimationActive={false}
      />
    );
  });
  return (
    <Panel
      title={title}
      note={note}
      action={
        <ChartExport
          points={exportPoints}
          metric={title}
          unit={unit}
          context={context}
          disabled={disabled}
        />
      }
    >
      {controls && <div className="report-chart-controls">{controls}</div>}
      {new Set(exportPoints.map((p) => p.key)).size > 200 && (
        <p className="chart-limit">
          Notionの200点を超えています。集計間隔を大きくするか期間を絞ってください。
        </p>
      )}
      {new Set(exportPoints.map((p) => p.seriesId)).size > 50 && (
        <p className="chart-limit">Notionの50系列を超えています。表示する系列を絞ってください。</p>
      )}
      {!series.length ? (
        <div className="report-chart-empty">この条件のデータはありません。</div>
      ) : (
        <>
          <div className="report-chart">
            <ResponsiveContainer width="100%" height="100%">
              {kind === "bar" ? (
                <BarChart data={rows} margin={{ top: 15, right: 14, bottom: 0, left: 0 }}>
                  {common}
                  {series.map(([key, name]) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={name}
                      fill={color(key)}
                      hide={hidden.includes(key)}
                      maxBarSize={38}
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={rows} margin={{ top: 15, right: 14, bottom: 0, left: 0 }}>
                  {common}
                  {lines}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="series-legend" role="group" aria-label={`${title}の表示系列`}>
            {series.map(([key, name]) => (
              <button
                key={key}
                aria-pressed={!hidden.includes(key)}
                onClick={() =>
                  setHidden((list) =>
                    list.includes(key) ? list.filter((k) => k !== key) : [...list, key],
                  )
                }
              >
                <span style={{ background: color(key) }} />
                {name}
              </button>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
