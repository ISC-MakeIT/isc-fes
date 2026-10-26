"use client";
import type { GuestData, GuestFilters, GuestDaily } from "@/lib/types";
import { guestDefaults, parseGuestFilters } from "@/lib/report-filters";
import { dailyPoints, type ExportContext } from "@/lib/chart-data";
import { decimal, integer, minutes, shortDate, yen } from "@/lib/format";
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

const cohortLabels = {
  purchasers: "期間内の購入ゲスト",
  registered: "期間内の登録ゲスト（未購入を含む）",
};
const stayLabels = { closed: "未完了注文がない日のみ", observed: "未完了の日も含めた観測時間" };
const columns: TableColumn<GuestDaily>[] = [
  { key: "key", label: "日付（JST）" },
  { key: "registered", label: "新規登録（人）", format: (r) => integer(r.registered) },
  { key: "population", label: "購入額の母集団（人）", format: (r) => integer(r.population) },
  { key: "buyers", label: "購入ゲスト（人）", format: (r) => integer(r.buyers) },
  {
    key: "averageSpend",
    label: "平均購入額（円）",
    format: (r) => (r.averageSpend == null ? "—" : yen(r.averageSpend)),
  },
  {
    key: "medianSpend",
    label: "購入額中央値（円）",
    format: (r) => (r.medianSpend == null ? "—" : yen(r.medianSpend)),
  },
  {
    key: "averageStayMinutes",
    label: "平均観測時間（分）",
    format: (r) => minutes(r.averageStayMinutes),
  },
  {
    key: "medianStayMinutes",
    label: "観測時間中央値（分）",
    format: (r) => minutes(r.medianStayMinutes),
  },
  { key: "staySamples", label: "時間の対象（ゲスト日）", format: (r) => integer(r.staySamples) },
  {
    key: "singleObservationDays",
    label: "観測1点（ゲスト日）",
    format: (r) => integer(r.singleObservationDays),
  },
  { key: "openDays", label: "未完了あり（ゲスト日）", format: (r) => integer(r.openDays) },
];
export default function GuestReport() {
  const report = useReport<GuestFilters, GuestData>(
    "/api/guests",
    guestDefaults,
    parseGuestFilters,
  );
  const { filters, metadata, data, update, loading, pending, issue } = report;
  const disabled = loading || pending || !!issue;
  const context: ExportContext | null = data
    ? {
        ...data.filters,
        generatedAt: data.generatedAt,
        interval: intervalLabels[data.filters.interval],
        conditions: `受付=${channelLabels[data.filters.channel]}; 母集団=${cohortLabels[data.filters.cohort]}; 滞在時間=${stayLabels[data.filters.stay]}; 累計=${data.filters.cumulative === "total" ? "全期間" : "選択期間"}; 売上=受取完了のみ`,
      }
    : null;
  const dailyContext = context ? { ...context, interval: "1日ごと" } : null;
  const summary = data?.summary;
  return (
    <ReportFrame
      page="guests"
      filters={filters}
      metadata={metadata}
      loading={loading}
      error={report.error}
      onRefresh={report.refresh}
    >
      {filters && (
        <section className="filter-panel report-filters" aria-label="ゲスト分析の集計条件">
          <div className="report-filter-row">
            <PeriodFields filters={filters} update={update} />
            <label>
              <span>購入・行動の受付方法</span>
              <select
                aria-label="購入・行動の受付方法"
                value={filters.channel}
                onChange={(e) => update("channel", e.target.value as GuestFilters["channel"])}
              >
                {Object.entries(channelLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>購入額・時間の母集団</span>
              <select
                aria-label="ゲストの母集団"
                value={filters.cohort}
                onChange={(e) => update("cohort", e.target.value as GuestFilters["cohort"])}
              >
                {Object.entries(cohortLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>観測時間の対象</span>
              <select
                aria-label="観測時間の対象"
                value={filters.stay}
                onChange={(e) => update("stay", e.target.value as GuestFilters["stay"])}
              >
                {Object.entries(stayLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="filter-foot">
            <span>変更は自動反映 ／ 登録数は受付方法・母集団の条件にかかわらず全ゲストを集計</span>
            <span>日本時間</span>
          </div>
        </section>
      )}
      <ReportStatus loading={loading} data={data} issue={issue} pending={pending} />
      {data && context && dailyContext && summary && (
        <>
          <div className="report-section-heading">
            <div>
              <span className="section-number">01</span>
              <h2>登録と購入</h2>
            </div>
            <span>集計 {shortDate(data.generatedAt)}</span>
          </div>
          <div className="stats-grid report-stats">
            <Stat
              label="期間内の新規ゲスト"
              value={`${integer(summary.registered)}人`}
              note="guests.created_at に基づく登録数"
              accent
            />
            <Stat
              label="終了時点の累計ゲスト"
              value={`${integer(summary.totalRegistered)}人`}
              note="選択期間より前の登録も含む"
            />
            <Stat
              label="購入額・時間の母集団"
              value={`${integer(summary.population)}人`}
              note={cohortLabels[data.filters.cohort]}
            />
            <Stat
              label="ゲスト単位の平均購入額"
              value={summary.averageSpend == null ? "—" : yen(summary.averageSpend)}
              note="1人の期間内購入額を合計して平均"
            />
            <Stat
              label="ゲスト単位の購入額中央値"
              value={summary.medianSpend == null ? "—" : yen(summary.medianSpend)}
              note="期間内購入額をゲスト単位で並べた中央"
            />
          </div>
          <p className="report-note">
            {data.filters.cohort === "registered"
              ? "期間内に登録した全ゲストが母集団です。未購入ゲストの購入額は0円として含めます。"
              : "選択した受付方法で期間内に受取完了注文があるゲストが母集団です。"}{" "}
            購入額は期間内に作成された受取完了注文を合算します。代理の対面受付では同じゲストIDが使われる場合があるため、初期表示はモバイルです。
          </p>
          <div className="report-chart-grid">
            <SeriesChart
              title="累計ゲスト数推移"
              note="登録時刻のバケット終了時点までの累計。注文のないゲストも含みます。将来のバケットは欠測。"
              points={dailyPoints(data.registrations, [
                {
                  id: "registered",
                  label:
                    data.filters.cumulative === "total"
                      ? "累計ゲスト（全期間）"
                      : "累計ゲスト（選択期間）",
                  value: (r) =>
                    data.filters.cumulative === "total" ? r.cumulativeTotal : r.cumulativePeriod,
                  samples: (r) => r.registered,
                },
              ])}
              unit="人"
              context={context}
              disabled={disabled}
              controls={
                <label>
                  累計の開始点
                  <select
                    aria-label="累計の開始点"
                    value={filters?.cumulative}
                    onChange={(e) =>
                      update("cumulative", e.target.value as GuestFilters["cumulative"])
                    }
                  >
                    <option value="total">全期間（開始前の登録を含む）</option>
                    <option value="period">選択期間内（0から）</option>
                  </select>
                </label>
              }
            />
            <SeriesChart
              title="新規ゲスト数推移"
              note="guests.created_at に基づく時間帯ごとの登録数。受付方法による絞り込みはありません。"
              points={dailyPoints(data.registrations, [
                {
                  id: "new",
                  label: "新規登録",
                  value: (r) => r.registered,
                  samples: (r) => r.registered,
                },
              ])}
              unit="人"
              context={context}
              disabled={disabled}
            />
          </div>
          <div className="report-chart-grid">
            <SeriesChart
              title="ゲスト単位の購入額・日別推移"
              note={
                data.filters.cohort === "registered"
                  ? "登録済みの母集団に対し、各日の購入合計を集計。未購入は0円。登録前の日は対象外。"
                  : "その日に購入したゲストごとの購入合計を集計。期間全体の平均・中央値とは異なります。"
              }
              points={dailyPoints(data.daily, [
                {
                  id: "spendAverage",
                  label: "平均",
                  value: (r) => r.averageSpend,
                  samples: (r) => r.population,
                },
                {
                  id: "spendMedian",
                  label: "中央値",
                  value: (r) => r.medianSpend,
                  samples: (r) => r.population,
                },
              ])}
              unit="円"
              context={dailyContext}
              disabled={disabled}
            />
            <SeriesChart
              title="ゲスト単位の期間購入額の分布"
              note="ゲストごとの期間合計を1人1件として集計。"
              points={data.spendingDistribution.map((r, i) => ({
                key: `spend-${i}`,
                label: `${String(i + 1).padStart(2, "0")} ${r.name}`,
                seriesId: "guests",
                series: "ゲスト数",
                value: r.guests,
                samples: r.guests,
              }))}
              unit="人"
              context={{ ...context, interval: "期間全体・金額区間" }}
              disabled={disabled}
              kind="bar"
            />
          </div>
          <div className="report-section-heading">
            <div>
              <span className="section-number">02</span>
              <h2>観測できた滞在時間</h2>
            </div>
            <span>ゲスト × JSTの1日を1件として集計</span>
          </div>
          <div className="stats-grid report-stats">
            <Stat
              label="平均観測時間"
              value={minutes(summary.averageStayMinutes)}
              note="対象のゲスト日を同じ重みで平均"
              accent
            />
            <Stat
              label="観測時間の中央値"
              value={minutes(summary.medianStayMinutes)}
              note="夜をまたぐ時間は合算しません"
            />
            <Stat
              label="時間集計の対象"
              value={`${integer(summary.staySamples)}件`}
              note={`全観測 ${integer(summary.observationDays)}ゲスト日`}
            />
            <Stat
              label="観測が1点だけの日"
              value={`${integer(summary.singleObservationDays)}件`}
              note="時間は不明として平均から除外"
            />
            <Stat
              label="未完了注文がある日"
              value={`${integer(summary.openDays)}件`}
              note={
                data.filters.stay === "closed"
                  ? "時間の集計から除外中"
                  : "2点以上の観測があれば含む"
              }
            />
          </div>
          <div className="observation-note">
            <strong>会場での実際の滞在時間を表すものではありません。</strong>
            <p>
              各日の最初の注文・ゲスト操作から、最後の受取完了・キャンセル・ゲスト操作までを推定します。店舗スタッフの操作だけでは観測を延長しません。期間内に作成された注文と、その注文へのゲスト本人の
              activity_log を使います。
              {data.hasActivityLog
                ? ""
                : "activity_log がないため、注文の時刻のみで推定しています。"}
            </p>
            <p>
              未完了とは、選択期間の終了時点までに終了していない注文、または翌日に終了する注文がある日です。観測1点と未完了は重複する場合があります。
            </p>
          </div>
          <div className="report-chart-grid">
            <SeriesChart
              title="観測時間の平均・中央値推移"
              note="日ごとに集計。観測1点は欠測、未完了の扱いは上の条件で変更できます。"
              points={dailyPoints(data.daily, [
                {
                  id: "stayAverage",
                  label: "平均",
                  value: (r) => r.averageStayMinutes,
                  samples: (r) => r.staySamples,
                },
                {
                  id: "stayMedian",
                  label: "中央値",
                  value: (r) => r.medianStayMinutes,
                  samples: (r) => r.staySamples,
                },
              ])}
              unit="分"
              context={dailyContext}
              disabled={disabled}
            />
            <SeriesChart
              title="観測時間の分布"
              note="ゲスト日単位。各区間は下限以上・上限未満です。"
              points={data.stayDistribution.map((r, i) => ({
                key: `stay-${i}`,
                label: `${String(i + 1).padStart(2, "0")} ${r.name}`,
                seriesId: "days",
                series: "ゲスト日",
                value: r.days,
                samples: r.days,
              }))}
              unit="件"
              context={{ ...context, interval: "期間全体・時間区間" }}
              disabled={disabled}
              kind="bar"
            />
          </div>
          <Panel
            title="ゲスト分析の日別データ"
            note="登録数は全ゲスト、購入・時間は選択した母集団。個人のIDやメールアドレスは出力しません。"
          >
            <ReportTable
              rows={data.daily}
              columns={columns}
              label="日付"
              nameKey="key"
              initialSort="key"
              csvName="isc-fes-guests-daily.csv"
              disabled={disabled}
            />
          </Panel>
          <div className="guest-facts">
            <span>
              購入ゲスト <strong>{integer(summary.buyers)}人</strong>
            </span>
            <span>
              母集団の売上 <strong>{yen(summary.revenue)}</strong>
            </span>
            <span>
              1人あたり受付 <strong>{decimal(summary.averageOrders)}件</strong>
            </span>
            <span>
              1人あたり利用店舗 <strong>{decimal(summary.averageStores)}店舗</strong>
            </span>
          </div>
        </>
      )}
    </ReportFrame>
  );
}
