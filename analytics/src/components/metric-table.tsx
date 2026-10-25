"use client";
import { useState } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp, Search } from "lucide-react";
import type { MetricRow, Metrics } from "@/lib/types";
import { integer, minutes, percent, yen } from "@/lib/format";

type SortKey = keyof Metrics;
type Column = { key: SortKey; name: string; format: (n: number | null) => string };
const count = (n: number | null) => integer(n ?? 0);
const money = (n: number | null) => (n == null ? "—" : yen(n));
const columnDefinitions: Record<SortKey, Omit<Column, "key">> = {
  orders: { name: "注文数", format: count },
  pending: { name: "調理中件数", format: count },
  ready: { name: "受取待ち件数", format: count },
  completed: { name: "受取完了件数", format: count },
  cancelled: { name: "キャンセル件数", format: count },
  face: { name: "対面受付件数¹", format: count },
  guests: { name: "利用ゲスト数", format: count },
  revenue: { name: "売上", format: money },
  units: { name: "販売点数", format: count },
  salesOrders: { name: "売上対象の注文件数", format: count },
  cancellationRate: { name: "キャンセル率", format: percent },
  faceRate: { name: "対面受付率¹", format: percent },
  averageAmount: { name: "平均注文単価", format: money },
  averageMinutes: { name: "平均完了時間", format: minutes },
  medianMinutes: { name: "完了時間 中央値", format: minutes },
  p90Minutes: { name: "完了時間 P90", format: minutes },
  preparationMinutes: { name: "平均調理時間", format: minutes },
  preparationMedianMinutes: { name: "調理時間 中央値", format: minutes },
  preparationP90Minutes: { name: "調理時間 P90", format: minutes },
  preparationSamples: { name: "調理時間の対象件数", format: count },
  pickupMinutes: { name: "平均受取待ち時間", format: minutes },
  pickupMedianMinutes: { name: "受取待ち時間 中央値", format: minutes },
  pickupP90Minutes: { name: "受取待ち時間 P90", format: minutes },
  pickupSamples: { name: "受取待ち時間の対象件数", format: count },
  cancellationWaitMinutes: { name: "平均キャンセル待ち時間", format: minutes },
};
const basicKeys: SortKey[] = [
  "revenue",
  "orders",
  "units",
  "cancellationRate",
  "faceRate",
  "averageMinutes",
  "p90Minutes",
];
const operationGroups: { name: string; keys: SortKey[] }[] = [
  { name: "注文・受付", keys: ["orders", "cancellationRate", "faceRate"] },
  {
    name: "調理時間｜作成 → 調理完了",
    keys: [
      "preparationMinutes",
      "preparationMedianMinutes",
      "preparationP90Minutes",
      "preparationSamples",
    ],
  },
  {
    name: "受取待ち時間｜調理完了 → 受取完了",
    keys: ["pickupMinutes", "pickupMedianMinutes", "pickupP90Minutes", "pickupSamples"],
  },
  { name: "完了時間｜作成 → 受取完了", keys: ["averageMinutes", "medianMinutes", "p90Minutes"] },
  {
    name: "注文・受付の内訳",
    keys: ["pending", "ready", "completed", "cancelled", "face", "guests"],
  },
  { name: "売上・販売", keys: ["revenue", "units", "salesOrders", "averageAmount"] },
  { name: "調理完了 → キャンセル", keys: ["cancellationWaitMinutes"] },
];
export function MetricTable({
  rows,
  label = "店舗",
  compact = false,
  operations = false,
  onSelect,
}: {
  rows: MetricRow[];
  label?: string;
  compact?: boolean;
  operations?: boolean;
  onSelect?: (id: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>(operations ? "orders" : "revenue");
  const [asc, setAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const filtered = rows
    .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sort],
        bv = b[sort];
      if (av == null) return bv == null ? a.name.localeCompare(b.name) : 1;
      if (bv == null) return -1;
      return (asc ? av - bv : bv - av) || a.name.localeCompare(b.name);
    });
  const size = compact ? 5 : 15;
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / size) - 1));
  const shown = filtered.slice(safePage * size, (safePage + 1) * size);
  const grouped = operations && !compact;
  const keys: SortKey[] = compact
    ? ["revenue", "orders", "faceRate"]
    : grouped
      ? operationGroups.flatMap((g) => g.keys)
      : basicKeys;
  const visible: Column[] = keys.map((key) => ({ key, ...columnDefinitions[key] }));
  const metricHeader = (c: Column) => (
    <th
      key={c.key}
      scope="col"
      className="metric-column"
      aria-sort={sort === c.key ? (asc ? "ascending" : "descending") : "none"}
    >
      <button
        onClick={() => {
          if (sort === c.key) setAsc(!asc);
          else {
            setSort(c.key);
            setAsc(false);
          }
          setPage(0);
        }}
      >
        {c.name}
        {sort === c.key && (asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );
  return (
    <>
      {!compact && (
        <div className="table-toolbar">
          <label className="search">
            <Search size={15} />
            <input
              placeholder={`${label}を検索`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <span className="muted">{integer(filtered.length)}件・見出しで並べ替え</span>
        </div>
      )}
      {grouped && (
        <div className="table-scroll-hint">
          <ArrowLeftRight size={14} />
          <span>
            横にスクロールして全{visible.length}指標を表示 · 店舗名は固定 ·
            時間の対象がない場合は「—」
          </span>
        </div>
      )}
      <div
        className={`table-scroll ${grouped ? "operations-scroll" : ""}`}
        role={grouped ? "region" : undefined}
        aria-label={grouped ? `${label}ごとの詳細指標（横スクロール）` : undefined}
        tabIndex={grouped ? 0 : undefined}
      >
        <table className={grouped ? "operations-table" : undefined}>
          <thead>
            <tr className={grouped ? "column-groups" : undefined}>
              <th className="rank-cell" scope="col" rowSpan={grouped ? 2 : 1}>
                #
              </th>
              <th className="name-cell" scope="col" rowSpan={grouped ? 2 : 1}>
                {label}
              </th>
              {grouped
                ? operationGroups.map((g) => (
                    <th key={g.name} scope="colgroup" colSpan={g.keys.length}>
                      {g.name}
                    </th>
                  ))
                : visible.map(metricHeader)}
            </tr>
            {grouped && <tr>{visible.map(metricHeader)}</tr>}
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={row.key}>
                <td className="rank-cell">{safePage * size + i + 1}</td>
                <td className="name-cell" title={row.name}>
                  {onSelect ? (
                    <button className="table-link" onClick={() => onSelect(row.key)}>
                      {row.name}
                    </button>
                  ) : (
                    row.name
                  )}
                </td>
                {visible.map((c) => (
                  <td key={c.key} className={c.key === "revenue" ? "money-cell" : ""}>
                    {c.format(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="table-empty">該当するデータがありません。</p>}
      </div>
      {filtered.length > size && (
        <div className="pagination">
          <span>
            {safePage * size + 1}–{Math.min((safePage + 1) * size, filtered.length)} /{" "}
            {filtered.length}件
          </span>
          <div>
            <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              前へ
            </button>
            <button
              disabled={(safePage + 1) * size >= filtered.length}
              onClick={() => setPage(safePage + 1)}
            >
              次へ
            </button>
          </div>
        </div>
      )}
    </>
  );
}
