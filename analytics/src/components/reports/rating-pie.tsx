"use client";
import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ReviewRating } from "@/lib/types";
import { integer, percent } from "@/lib/format";
import type { ExportContext } from "@/lib/chart-data";
import { ChartExport, Panel } from "./shared";
const colors = ["#cc8173", "#d5a46f", "#d5c57e", "#8bb38b", "#347d59"];
export function RatingPie({
  title,
  rows,
  context,
  disabled,
  onRating,
}: {
  title: string;
  rows: ReviewRating[];
  context: ExportContext;
  disabled: boolean;
  onRating: (rating: number) => void;
}) {
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const data = rows.map((r) => ({ ...r, name: `★${r.rating}`, fill: colors[r.rating - 1] }));
  return (
    <Panel
      title={title}
      note="割合はこの区分のレビュー件数を分母に計算。凡例から区分・ratingを絞り込めます。"
      action={
        <ChartExport
          points={data.map((r) => ({
            key: `rating-${r.rating}`,
            label: r.name,
            seriesId: title,
            series: title,
            value: r.share,
            samples: r.count,
          }))}
          metric={title}
          unit="%"
          context={context}
          disabled={disabled}
        />
      }
    >
      <div className="rating-pie-layout">
        <div
          className="rating-donut"
          role="img"
          aria-label={`${title}：${rows.map((r) => `rating ${r.rating}は${integer(r.count)}件、${percent(r.share)}`).join("。")}`}
        >
          {count ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.filter((r) => r.count > 0)}
                  dataKey="count"
                  nameKey="name"
                  innerRadius="57%"
                  outerRadius="85%"
                  stroke="#fff"
                  strokeWidth={3}
                  isAnimationActive={false}
                />
                <Tooltip formatter={(v) => `${integer(Number(v))}件`} />
                <text
                  x="50%"
                  y="47%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#35583d"
                  fontSize={25}
                  fontWeight={600}
                >
                  {integer(count)}
                </text>
                <text x="50%" y="60%" textAnchor="middle" fill="#8a987f" fontSize={10}>
                  REVIEWS
                </text>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="rating-empty">レビューなし</div>
          )}
        </div>
        <div className="rating-legend">
          {data.map((r) => (
            <button
              key={r.rating}
              disabled={disabled || !r.count}
              onClick={() => onRating(r.rating)}
              aria-label={`${title}のrating ${r.rating}で絞り込む`}
            >
              <span className="rating-dot" style={{ background: r.fill }} />
              <span>★{r.rating}</span>
              <strong>{percent(r.share)}</strong>
              <small>{integer(r.count)}件</small>
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}
