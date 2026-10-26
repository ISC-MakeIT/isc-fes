"use client";
import { useState } from "react";
import { Check, Store } from "lucide-react";
import type { AnalyticsData, Metrics, MetricRow, StoreFilters } from "@/lib/types";
import { parseStoreFilters, storeDefaults } from "@/lib/report-filters";
import { menuChartPoints, storeChartPoints, type ExportContext } from "@/lib/chart-data";
import { integer, minutes, percent, shortDate, yen } from "@/lib/format";
import { useReport } from "./use-report";
import {
  channelLabels,
  intervalLabels,
  Panel,
  PeriodFields,
  ReportFrame,
  ReportStatus,
  ReportTable,
  Stat,
  type TableColumn,
} from "./shared";
import { SeriesChart } from "./series-chart";

type StoreData = AnalyticsData & { filters: StoreFilters };
const salesLabels = {
  completed: "受取完了のみ",
  accepted: "キャンセルを除く",
  all: "全注文（キャンセルを含む）",
};
const timeMetrics = {
  preparation: [
    "調理時間",
    "preparationMinutes",
    "preparationMedianMinutes",
    "注文 → 調理完了。ready_at がある注文を集計。",
  ],
  pickup: [
    "受け取り待ち時間",
    "pickupMinutes",
    "pickupMedianMinutes",
    "調理完了 → 受取完了。両方の時刻がある注文を集計。",
  ],
  total: [
    "注文完了までの時間",
    "averageMinutes",
    "medianMinutes",
    "注文 → 受取完了。completed_at がある注文を集計。",
  ],
  cancellation: [
    "キャンセルまでの時間",
    "cancellationMinutes",
    "cancellationMedianMinutes",
    "注文 → キャンセル。cancelled_at がある注文を集計。",
  ],
  cancellationWait: [
    "キャンセル待ち時間",
    "cancellationWaitMinutes",
    "cancellationWaitMedianMinutes",
    "調理完了 → キャンセル。両方の時刻がある注文を集計。",
  ],
} as const;
function amount(value: number | null) {
  return value == null ? "—" : yen(value);
}
const countColumns: TableColumn<MetricRow>[] = [
  { key: "revenue", label: "売上（円）", format: (r) => yen(r.revenue) },
  { key: "units", label: "販売数（点）", format: (r) => integer(r.units) },
  { key: "orders", label: "受付数（件）", format: (r) => integer(r.orders) },
  { key: "salesOrders", label: "売上対象注文（件）", format: (r) => integer(r.salesOrders) },
  { key: "averageAmount", label: "平均単価（円）", format: (r) => amount(r.averageAmount) },
  { key: "medianAmount", label: "単価中央値（円）", format: (r) => amount(r.medianAmount) },
  { key: "guests", label: "ゲスト数（人）", format: (r) => integer(r.guests) },
  {
    key: "cancellationRate",
    label: "キャンセル率（%）",
    format: (r) => percent(r.cancellationRate),
  },
  { key: "faceRate", label: "対面受付率（%）", format: (r) => percent(r.faceRate) },
];
const durationColumns = Object.values(timeMetrics).flatMap(
  ([, average, median]) =>
    [
      {
        key: average,
        label: `${timeMetricsLabel(average)}・平均（分）`,
        format: (r: MetricRow) => minutes(r[average]),
      },
      {
        key: median,
        label: `${timeMetricsLabel(average)}・中央値（分）`,
        format: (r: MetricRow) => minutes(r[median]),
      },
    ] satisfies TableColumn<MetricRow>[],
);
function timeMetricsLabel(metric: keyof Metrics) {
  return Object.values(timeMetrics).find((v) => v[1] === metric)?.[0] ?? "";
}
const columns: TableColumn<MetricRow>[] = [
  { key: "name", label: "店舗名" },
  ...countColumns,
  ...durationColumns,
  { key: "preparationSamples", label: "調理時間の対象（件）" },
  { key: "pickupSamples", label: "受取待ちの対象（件）" },
  { key: "completed", label: "受取完了（件）" },
  { key: "cancelled", label: "キャンセル（件）" },
  { key: "face", label: "対面受付（件）" },
];
export default function StoreReport() {
  const report = useReport<StoreFilters, StoreData>(
    "/api/stores",
    storeDefaults,
    parseStoreFilters,
  );
  const { filters, metadata, data, update, loading, pending, issue } = report;
  const [volume, setVolume] = useState<"units" | "orders">("units");
  const [time, setTime] = useState<keyof typeof timeMetrics>("preparation");
  const [statistic, setStatistic] = useState<"average" | "median" | "both">("both");
  const [menuMetric, setMenuMetric] = useState<"revenue" | "units">("revenue");
  const [selectedMenus, setSelectedMenus] = useState<string[] | null>(null);
  const disabled = loading || pending || !!issue;
  const cumulative = data?.filters.accumulation === "cumulative";
  const trendSuffix = cumulative ? "（累積）" : "";
  const context: ExportContext | null = data
    ? {
        ...data.filters,
        generatedAt: data.generatedAt,
        interval: intervalLabels[data.filters.interval],
        conditions: `店舗=${
          data.filters.storeIds.length
            ? metadata?.stores
                .filter((s) => data.filters.storeIds.includes(s.id))
                .map((s) => s.name)
                .join("・")
            : "すべて"
        }; 受付=${channelLabels[data.filters.channel]}; 売上=${salesLabels[data.filters.sales]}; メニュー=${data.filters.menu || "すべて"}; 状態=${data.filters.status}; グラフ=${cumulative ? "累積（選択期間の開始から）" : "区間ごと"}`,
      }
    : null;
  const availableMenus = data?.menus ?? [];
  const menus = (selectedMenus ?? availableMenus.slice(0, 5).map((m) => m.key)).filter((id) =>
    availableMenus.some((m) => m.key === id),
  );
  const menuRows = availableMenus.map((m) => ({
    ...m,
    share: data?.summary.revenue ? (100 * m.revenue) / data.summary.revenue : null,
  }));
  return (
    <ReportFrame
      page="stores"
      filters={filters}
      metadata={metadata}
      loading={loading}
      error={report.error}
      onRefresh={report.refresh}
    >
      {filters && metadata && (
        <section className="filter-panel report-filters" aria-label="店舗分析の集計条件">
          <div className="report-filter-row">
            <PeriodFields filters={filters} update={update} />
            <label>
              <span>グラフの集計</span>
              <select
                aria-label="グラフの集計"
                value={filters.accumulation}
                onChange={(e) =>
                  update("accumulation", e.target.value as StoreFilters["accumulation"])
                }
              >
                <option value="interval">区間ごと</option>
                <option value="cumulative">累積（選択期間の開始から）</option>
              </select>
            </label>
            <label>
              <span>受付方法</span>
              <select
                aria-label="受付方法"
                value={filters.channel}
                onChange={(e) => update("channel", e.target.value as StoreFilters["channel"])}
              >
                {Object.entries(channelLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>売上の対象</span>
              <select
                aria-label="売上の対象"
                value={filters.sales}
                onChange={(e) => update("sales", e.target.value as StoreFilters["sales"])}
              >
                {Object.entries(salesLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>メニューで絞る</span>
              <select
                aria-label="メニューで絞る"
                value={filters.menu}
                onChange={(e) => update("menu", e.target.value)}
              >
                <option value="">すべてのメニュー</option>
                {metadata.menus
                  .filter((m) => !filters.storeIds.length || filters.storeIds.includes(m.storeId))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} / {metadata.stores.find((s) => s.id === m.storeId)?.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <details className="store-picker-disclosure">
            <summary>
              比較する店舗：
              {filters.storeIds.length ? `${filters.storeIds.length}店舗を選択中` : "すべての店舗"}
            </summary>
            <div className="store-picker">
              <span className="picker-label">
                <Store size={15} />
                比較する店舗
              </span>
              <button
                className={`store-chip ${!filters.storeIds.length ? "selected" : ""}`}
                aria-pressed={!filters.storeIds.length}
                onClick={() => {
                  update("storeIds", []);
                  update("menu", "");
                }}
              >
                すべて
              </button>
              {metadata.stores.map((s) => (
                <button
                  key={s.id}
                  className={`store-chip ${filters.storeIds.includes(s.id) ? "selected" : ""}`}
                  aria-pressed={filters.storeIds.includes(s.id)}
                  onClick={() => {
                    update(
                      "storeIds",
                      filters.storeIds.includes(s.id)
                        ? filters.storeIds.filter((id) => id !== s.id)
                        : [...filters.storeIds, s.id],
                    );
                    update("menu", "");
                  }}
                >
                  {filters.storeIds.includes(s.id) && <Check size={12} />}
                  {s.name}
                </button>
              ))}
            </div>
          </details>
          <div className="filter-foot">
            <span>変更は自動反映 ／ 店舗をクリックして比較、表の店舗名から1店舗に絞れます。</span>
            <span>注文日時基準・日本時間</span>
          </div>
        </section>
      )}
      <ReportStatus loading={loading} data={data} issue={issue} pending={pending} />
      {data && context && (
        <>
          <div className="report-section-heading">
            <div>
              <span className="section-number">01</span>
              <h2>店舗のパフォーマンス</h2>
            </div>
            <span>
              集計 {shortDate(data.generatedAt)} ／ {integer(data.stores.length)}店舗
            </span>
          </div>
          <div className="stats-grid report-stats">
            <Stat
              label="売上"
              value={yen(data.summary.revenue)}
              note={salesLabels[data.filters.sales]}
              accent
            />
            <Stat
              label="販売数 / 受付数"
              value={`${integer(data.summary.units)}点 / ${integer(data.summary.orders)}件`}
              note="数量と注文数は別に集計"
            />
            <Stat
              label="キャンセル率"
              value={percent(data.summary.cancellationRate)}
              note={`${integer(data.summary.cancelled)}件 / 全受付`}
            />
            <Stat
              label="対面受付率"
              value={percent(data.summary.faceRate)}
              note={`${integer(data.summary.face)}件 / 全受付・代理注文から推定`}
            />
            <Stat
              label="ゲスト数"
              value={`${integer(data.summary.guests)}人`}
              note="期間内の重複を除いたID数"
            />
          </div>
          <p className="report-note">
            すべて注文の作成時刻で区切っています。売上対象の変更は売上・販売数・単価に反映され、率の分母は選択条件の全受付です。各店舗のゲスト数は重複を除きますが、店舗間では同じゲストが含まれます。凡例を押すと系列の表示・CSV対象を切り替えられます。
            {cumulative &&
              "累積は選択期間の開始から各区間の末尾までを集計します。率・平均・中央値は対象注文から再計算し、ゲスト数は期間内で重複を除きます。上の指標と表は期間全体の統計です。CSVは累積済みなのでNotionの「累積」はオフにしてください。"}
          </p>
          <div className="report-chart-grid">
            <SeriesChart
              title={`店舗ごとの売上推移${trendSuffix}`}
              note="注文時点の金額・トッピング込み"
              points={storeChartPoints(data, "revenue")}
              unit="円"
              context={context}
              cumulative={cumulative}
              disabled={disabled}
            />
            <SeriesChart
              title={`${volume === "units" ? "店舗ごとの販売数推移" : "店舗ごとの受付数推移"}${trendSuffix}`}
              note={
                volume === "units"
                  ? "売上対象の商品の数量。セットの個数を含みます。"
                  : "1注文を1件として、全受付を集計。"
              }
              points={storeChartPoints(data, volume)}
              unit={volume === "units" ? "点" : "件"}
              context={context}
              cumulative={cumulative}
              disabled={disabled}
              controls={
                <label>
                  表示
                  <select
                    aria-label="販売数・受付数"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value as typeof volume)}
                  >
                    <option value="units">販売数（点）</option>
                    <option value="orders">受付数（件）</option>
                  </select>
                </label>
              }
            />
            <SeriesChart
              title={`店舗ごとのキャンセル率推移${trendSuffix}`}
              note={
                cumulative
                  ? "期間開始からのキャンセル数 ÷ 全受付数。受付0件は欠測。"
                  : "各時間帯のキャンセル数 ÷ 全受付数。受付0件は欠測。"
              }
              points={storeChartPoints(data, "cancellationRate")}
              unit="%"
              context={context}
              cumulative={cumulative}
              disabled={disabled}
            />
            <SeriesChart
              title={`店舗ごとの対面受付率推移${trendSuffix}`}
              note={`${cumulative ? "期間開始からの" : ""}代理注文フラグのある注文 ÷ 全受付数。受付0件は欠測。`}
              points={storeChartPoints(data, "faceRate")}
              unit="%"
              context={context}
              cumulative={cumulative}
              disabled={disabled}
            />
            <SeriesChart
              title={`店舗ごとのゲスト数推移${trendSuffix}`}
              note={
                cumulative
                  ? "期間開始からの店舗内ユニークゲスト。複数区間で注文しても1人。"
                  : "各時間帯・店舗内のユニークゲスト。期間合計は足し算できません。"
              }
              points={storeChartPoints(data, "guests")}
              unit="人"
              context={context}
              cumulative={cumulative}
              disabled={disabled}
            />
            <SeriesChart
              title={`店舗ごとの${timeMetrics[time][0]}推移${trendSuffix}`}
              note={`${timeMetrics[time][3]}${cumulative ? "期間開始からの対象注文で平均・中央値を再計算。" : ""}`}
              points={storeChartPoints(data, timeMetrics[time][1], statistic, timeMetrics[time][2])}
              unit="分"
              context={context}
              cumulative={cumulative}
              disabled={disabled}
              controls={
                <>
                  <label>
                    時間の種類
                    <select
                      aria-label="時間の種類"
                      value={time}
                      onChange={(e) => setTime(e.target.value as typeof time)}
                    >
                      {Object.entries(timeMetrics).map(([key, v]) => (
                        <option key={key} value={key}>
                          {v[0]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    統計量
                    <select
                      aria-label="時間の統計量"
                      value={statistic}
                      onChange={(e) => setStatistic(e.target.value as typeof statistic)}
                    >
                      <option value="both">平均と中央値</option>
                      <option value="average">平均</option>
                      <option value="median">中央値</option>
                    </select>
                  </label>
                </>
              }
            />
          </div>
          <Panel
            title="店舗ごとの統計"
            note="単価は1注文あたり。時間の対象がない場合は「—」。左右にスクロールして比較できます。"
          >
            <ReportTable
              rows={data.stores}
              columns={columns}
              label="店舗"
              nameKey="name"
              initialSort="revenue"
              onSelect={(row) => {
                update("storeIds", [row.key]);
                update("menu", "");
              }}
              csvName="isc-fes-stores.csv"
              disabled={disabled}
            />
          </Panel>
          <div className="report-section-heading">
            <div>
              <span className="section-number">02</span>
              <h2>メニューから見る</h2>
            </div>
            <span>売上・数量・注文の内訳</span>
          </div>
          <SeriesChart
            title={`メニューごとの${menuMetric === "revenue" ? "売上" : "販売数"}推移${trendSuffix}`}
            note="初期表示は売上上位5メニュー。表示するメニューを選べます。調理時間は同じ注文の全体時間です。"
            points={menuChartPoints(data, menuMetric, menus)}
            unit={menuMetric === "revenue" ? "円" : "点"}
            context={context}
            cumulative={cumulative}
            disabled={disabled}
            controls={
              <>
                <label>
                  指標
                  <select
                    aria-label="メニューの指標"
                    value={menuMetric}
                    onChange={(e) => setMenuMetric(e.target.value as typeof menuMetric)}
                  >
                    <option value="revenue">売上</option>
                    <option value="units">販売数</option>
                  </select>
                </label>
                <details className="menu-selector">
                  <summary>表示メニュー（{menus.length}）</summary>
                  <div className="menu-options">
                    {availableMenus.map((m) => (
                      <label key={m.key}>
                        <input
                          type="checkbox"
                          checked={menus.includes(m.key)}
                          onChange={() =>
                            setSelectedMenus(
                              menus.includes(m.key)
                                ? menus.filter((id) => id !== m.key)
                                : [...menus, m.key],
                            )
                          }
                        />
                        {m.name}
                      </label>
                    ))}
                    <button className="button" onClick={() => setSelectedMenus(null)}>
                      上位5件に戻す
                    </button>
                  </div>
                </details>
              </>
            }
          />
          <Panel
            title="メニューごとの統計"
            note="1注文に複数メニューがある場合、注文数・ゲスト数・時間はメニュー間で重複します。売上と数量はメニューごとに分けています。"
          >
            <ReportTable
              rows={menuRows}
              columns={[
                { key: "name", label: "メニュー / 店舗" },
                ...countColumns,
                { key: "share", label: "売上構成比（%）", format: (r) => percent(r.share) },
                ...durationColumns,
              ]}
              label="メニュー"
              nameKey="name"
              initialSort="revenue"
              csvName="isc-fes-menus.csv"
              disabled={disabled}
            />
          </Panel>
          <p className="report-note">
            時刻が欠けている注文は、該当する時間の集計から除外します。調理完了時刻は注文全体の
            ready_at
            で、商品ごとの実測調理時間ではありません。単価・率・時間は各条件で再計算し、P90は表示していません。
          </p>
        </>
      )}
    </ReportFrame>
  );
}
