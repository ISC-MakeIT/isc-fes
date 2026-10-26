"use client";
import { Download } from "lucide-react";
import type { OverviewData, OverviewFilters } from "@/lib/types";
import {
  overviewCSV,
  overviewDefaults,
  overviewSalesLabels,
  parseOverviewFilters,
} from "@/lib/overview";
import { downloadCSV } from "@/lib/csv";
import { dailyPoints, type ExportContext } from "@/lib/chart-data";
import { integer, percent, shortDate, yen } from "@/lib/format";
import { useReport } from "./use-report";
import { intervalLabels, Panel, PeriodFields, ReportFrame, ReportStatus, Stat } from "./shared";
import { SeriesChart } from "./series-chart";

export default function OverviewReport() {
  const report = useReport<OverviewFilters, OverviewData>(
    "/api/overview",
    overviewDefaults,
    parseOverviewFilters,
  );
  const { filters, metadata, data, loading, pending, issue, update } = report;
  const disabled = loading || pending || !!issue;
  const context: ExportContext | null = data
    ? {
        ...data.filters,
        interval: intervalLabels[data.filters.interval],
        generatedAt: data.generatedAt,
        conditions: `全店舗・全受付・全状態; 売上=${overviewSalesLabels[data.filters.sales]}; 累計=選択期間の開始から; 時刻=各区間の終了（未満）`,
      }
    : null;
  return (
    <ReportFrame
      page="overview"
      filters={filters}
      metadata={metadata}
      loading={loading}
      error={report.error}
      onRefresh={report.refresh}
    >
      {filters && (
        <section className="filter-panel report-filters" aria-label="全体分析の集計条件">
          <div className="report-filter-row">
            <PeriodFields filters={filters} update={update} />
            <label>
              <span>売上の対象</span>
              <select
                aria-label="売上の対象"
                value={filters.sales}
                onChange={(e) => update("sales", e.target.value as OverviewFilters["sales"])}
              >
                {Object.entries(overviewSalesLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="filter-foot">
            <span>全店舗・全受付を合算 ／ 選択期間の開始からの累計</span>
            <span>日本時間・注文作成時刻が開始以上／終了未満</span>
          </div>
        </section>
      )}
      <ReportStatus loading={loading} data={data} issue={issue} pending={pending} />
      {data && context && (
        <>
          <div className="report-section-heading">
            <div>
              <span className="section-number">01</span>
              <h2>学園祭全体の累計</h2>
            </div>
            <button
              className="button"
              disabled={disabled || !data.timeline.length}
              onClick={() =>
                downloadCSV(
                  overviewCSV(data),
                  `isc-fes-overall-cumulative-${data.filters.start.slice(0, 10)}.csv`,
                )
              }
            >
              <Download size={13} />
              全体の累計CSV（Notion用）
            </button>
          </div>
          <div className="stats-grid report-stats overview-stats">
            <Stat
              label="累計売上"
              value={yen(data.summary.revenue)}
              note={`${overviewSalesLabels[data.filters.sales]}・${integer(data.summary.salesOrders)}件`}
              accent
            />
            <Stat
              label="累計注文件数"
              value={`${integer(data.summary.orders)}件`}
              note="キャンセル・未完了を含む全受付"
            />
            <Stat
              label="累計キャンセル率"
              value={percent(data.summary.cancellationRate)}
              note={`${integer(data.summary.cancelled)}件 / 全受付`}
            />
            <Stat
              label="累計対面受付率"
              value={percent(data.summary.faceRate)}
              note={`${integer(data.summary.face)}件 / 全受付・代理注文から推定`}
            />
          </div>
          <p className="report-note">
            売上は注文時の金額（トッピング込み）。全指標を注文作成時刻に帰属させ、現在の注文状態で集計します。各点は表示時刻より前までの累計で、最後の点は期間末または集計時刻までです。率は累計件数から再計算し、受付0件は空欄にします。店舗分析の店舗・メニュー・受付方法の絞り込みは引き継ぎません。
          </p>
          <div className="report-chart-grid">
            <SeriesChart
              title="全体の売上推移（累計）"
              note="期間開始からの売上対象注文の合計金額。"
              points={dailyPoints(data.timeline, [
                {
                  id: "overall",
                  label: "全体",
                  value: (r) => r.revenue,
                  samples: (r) => r.salesOrders,
                },
              ])}
              unit="円"
              context={context}
              disabled={disabled}
              cumulative
            />
            <SeriesChart
              title="全体の注文件数推移（累計）"
              note="1注文を1件として、キャンセル・未完了を含めて集計。"
              points={dailyPoints(data.timeline, [
                { id: "overall", label: "全体", value: (r) => r.orders, samples: (r) => r.orders },
              ])}
              unit="件"
              context={context}
              disabled={disabled}
              cumulative
            />
            <SeriesChart
              title="全体のキャンセル率推移（累計）"
              note="累計キャンセル件数 ÷ 累計注文件数 × 100。"
              points={dailyPoints(data.timeline, [
                {
                  id: "overall",
                  label: "全体",
                  value: (r) => r.cancellationRate,
                  samples: (r) => r.orders,
                },
              ])}
              unit="%"
              context={context}
              disabled={disabled}
              cumulative
            />
            <SeriesChart
              title="全体の対面受付率推移（累計）"
              note="累計代理注文件数 ÷ 累計注文件数 × 100。"
              points={dailyPoints(data.timeline, [
                {
                  id: "overall",
                  label: "全体",
                  value: (r) => r.faceRate,
                  samples: (r) => r.orders,
                },
              ])}
              unit="%"
              context={context}
              disabled={disabled}
              cumulative
            />
          </div>
          <Panel
            title="Notionへの取り込み"
            note={`集計 ${shortDate(data.generatedAt)} ／ ${integer(data.timeline.length)}時点`}
          >
            <div className="report-note">
              <p>
                上の「全体の累計CSV」は1時刻1行で、売上・注文件数・2つの率を別々の数値列にまとめます。分母・分子の累計件数と期間・売上条件も含めます。
              </p>
              <p>
                Notionでは「名前」をタイトル、「集計時点JST」をテキスト、金額・件数・率の列を数値に設定します。チャートごとに同じ横軸と必要な数値列を選び、横軸を昇順に並べます。系列のグルーピングは不要です。率は0〜100の値（例：25＝25%）なので、数値のまま扱ってください。計算済みのためNotion側の「累積」はオフにします。
              </p>
              <p>
                別々のDBで使う場合は、各グラフの「CSV」から指標ごとに出力できます。再取り込み時は既存行との重複に注意してください。
              </p>
            </div>
          </Panel>
        </>
      )}
    </ReportFrame>
  );
}
