"use client";
import { useState } from "react";
import { Download, Search, Star } from "lucide-react";
import type { ReviewAudience, ReviewData, ReviewFilters, ReviewStats } from "@/lib/types";
import {
  parseReviewFilters,
  reviewDefaults,
  reviewAudienceLabels,
  reviewTriggerName,
} from "@/lib/reviews";
import { reportParams } from "@/lib/report-filters";
import { decimal, integer, percent, shortDate } from "@/lib/format";
import type { ExportContext } from "@/lib/chart-data";
import { useReport } from "./use-report";
import {
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
import { RatingPie } from "./rating-pie";

const statsColumns: TableColumn<ReviewStats>[] = [
  { key: "count", label: "レビュー（件）", format: (r) => integer(r.count) },
  { key: "averageRating", label: "rating 平均", format: (r) => decimal(r.averageRating, 2) },
  { key: "medianRating", label: "rating 中央値", format: (r) => decimal(r.medianRating, 2) },
  { key: "commentCount", label: "コメントあり（件）", format: (r) => integer(r.commentCount) },
  { key: "commentRate", label: "コメント率（%）", format: (r) => percent(r.commentRate) },
  { key: "highRate", label: "★4–5の割合（%）", format: (r) => percent(r.highRate) },
  { key: "lowRate", label: "★1–2の割合（%）", format: (r) => percent(r.lowRate) },
];
const audiences = Object.keys(reviewAudienceLabels) as ReviewAudience[];
export default function ReviewReport() {
  const report = useReport<ReviewFilters, ReviewData>(
    "/api/reviews",
    reviewDefaults,
    parseReviewFilters,
  );
  const { filters, metadata, data, loading, pending, issue } = report;
  const [trend, setTrend] = useState<"both" | "average" | "median" | "count">("both");
  const disabled = loading || pending || !!issue;
  const reviewExport =
    disabled || !data ? (
      <button className="button" disabled>
        <Download size={13} />
        Notion用レビューCSV
      </button>
    ) : (
      <a
        className="button"
        href={`/api/reviews/export?${reportParams(data.filters)}`}
        download="isc-fes-reviews.csv"
      >
        <Download size={13} />
        Notion用レビューCSV
      </a>
    );
  function update<K extends keyof ReviewFilters>(key: K, value: ReviewFilters[K]) {
    report.setFilters((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      if (key !== "page") next.page = 0;
      return next;
    });
  }
  function selectTrigger(value: string) {
    report.setFilters((prev) =>
      prev
        ? {
            ...prev,
            page: 0,
            missingTrigger: value === "missing",
            trigger: value.startsWith("value:") ? value.slice(6) : "",
          }
        : prev,
    );
  }
  function selectRating(rating: number, audience?: ReviewAudience) {
    report.setFilters((prev) =>
      prev
        ? {
            ...prev,
            page: 0,
            audience: audience ?? prev.audience,
            ratingMin: rating,
            ratingMax: rating,
          }
        : prev,
    );
  }
  const context: ExportContext | null = data
    ? {
        ...data.filters,
        generatedAt: data.generatedAt,
        interval: intervalLabels[data.filters.interval],
        conditions: `区分=${data.filters.audience === "all" ? "すべて" : reviewAudienceLabels[data.filters.audience]}; trigger=${data.filters.missingTrigger ? "未設定" : data.filters.trigger || "すべて"}; rating=${data.filters.ratingMin}–${data.filters.ratingMax}; コメント=${data.filters.comment}; 検索=${data.filters.search || "なし"}; 基準=レビュー投稿時刻`,
      }
    : null;
  const seriesAudiences = data
    ? audiences.filter((a) => data.filters.audience === "all" || a === data.filters.audience)
    : [];
  const points = data
    ? data.timeline
        .filter((r) => seriesAudiences.includes(r.audience))
        .flatMap((r) => {
          const variants =
            trend === "count"
              ? ([["count", "件数"]] as const)
              : trend === "average"
                ? ([["averageRating", "平均"]] as const)
                : trend === "median"
                  ? ([["medianRating", "中央値"]] as const)
                  : ([
                      ["averageRating", "平均"],
                      ["medianRating", "中央値"],
                    ] as const);
          return variants.map(([metric, label]) => ({
            key: r.key,
            label: r.name,
            seriesId: `${r.audience}:${metric}`,
            series: `${reviewAudienceLabels[r.audience]} / ${label}`,
            value: r[metric],
            samples: r.count,
          }));
        })
    : [];
  const triggerRows =
    data?.triggers.map((r) => ({
      ...r,
      name: reviewTriggerName(r.trigger),
      triggerCode: r.trigger ?? "（未設定）",
      audienceName: reviewAudienceLabels[r.audience],
    })) ?? [];
  return (
    <ReportFrame
      page="reviews"
      filters={filters}
      metadata={metadata}
      loading={loading}
      error={report.error}
      onRefresh={report.refresh}
    >
      {filters && metadata && (
        <section className="filter-panel report-filters" aria-label="レビュー分析の集計条件">
          <div className="report-filter-row">
            <PeriodFields filters={filters} update={update} />
            <label>
              <span>区分（trigger基準）</span>
              <select
                aria-label="レビューの区分"
                value={filters.audience}
                onChange={(e) => update("audience", e.target.value as ReviewFilters["audience"])}
              >
                <option value="all">すべて</option>
                {audiences.map((a) => (
                  <option key={a} value={a}>
                    {reviewAudienceLabels[a]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>投稿のきっかけ（trigger）</span>
              <select
                aria-label="投稿のきっかけ"
                value={
                  filters.missingTrigger
                    ? "missing"
                    : filters.trigger
                      ? `value:${filters.trigger}`
                      : "all"
                }
                onChange={(e) => selectTrigger(e.target.value)}
              >
                <option value="all">すべてのtrigger</option>
                <option value="missing">未設定</option>
                {metadata.reviewTriggers.map((t) => (
                  <option key={t} value={`value:${t}`}>
                    {reviewTriggerName(t)}（{t}）
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>rating 下限</span>
              <select
                aria-label="rating 下限"
                value={filters.ratingMin}
                onChange={(e) => update("ratingMin", Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>
                    ★{r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>rating 上限</span>
              <select
                aria-label="rating 上限"
                value={filters.ratingMax}
                onChange={(e) => update("ratingMax", Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>
                    ★{r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>コメントの有無</span>
              <select
                aria-label="コメントの有無"
                value={filters.comment}
                onChange={(e) => update("comment", e.target.value as ReviewFilters["comment"])}
              >
                <option value="all">すべて</option>
                <option value="with">コメントあり</option>
                <option value="without">ratingのみ</option>
              </select>
            </label>
          </div>
          <div className="review-search-row">
            <label className="search">
              <Search size={15} />
              <input
                aria-label="レビューのコメント検索"
                placeholder="コメントを検索（集計にも反映）"
                maxLength={200}
                value={filters.search}
                onChange={(e) => update("search", e.target.value)}
              />
            </label>
            <button
              className="button"
              onClick={() =>
                report.setFilters({
                  ...filters,
                  audience: "all",
                  trigger: "",
                  missingTrigger: false,
                  ratingMin: 1,
                  ratingMax: 5,
                  comment: "all",
                  search: "",
                  page: 0,
                })
              }
            >
              絞り込みをクリア
            </button>
          </div>
          <div className="filter-foot">
            <span>条件変更は自動反映 ／ 投稿時刻が開始以上・終了未満</span>
            <span>日本時間・1レビューを1件として集計</span>
          </div>
        </section>
      )}
      <ReportStatus loading={loading} data={data} issue={issue} pending={pending} />
      {data && context && (
        <>
          <div className="report-section-heading">
            <div>
              <span className="section-number">01</span>
              <h2>満足度の全体像</h2>
            </div>
            <div>
              <span>集計 {shortDate(data.generatedAt)}</span>
              {reviewExport}
            </div>
          </div>
          <div className="stats-grid report-stats">
            <Stat
              label="レビュー数"
              value={`${integer(data.summary.count)}件`}
              note="選択した条件に一致する投稿"
              accent
            />
            <Stat
              label="rating 平均"
              value={
                data.summary.averageRating == null
                  ? "—"
                  : `${decimal(data.summary.averageRating, 2)} / 5`
              }
              note="投稿ごとのratingを平均"
            />
            <Stat
              label="rating 中央値"
              value={
                data.summary.medianRating == null
                  ? "—"
                  : `${decimal(data.summary.medianRating, 2)} / 5`
              }
              note="ratingを並べた中央の値"
            />
            <Stat
              label="コメントあり"
              value={`${integer(data.summary.commentCount)}件`}
              note={`全投稿の ${percent(data.summary.commentRate)}`}
            />
            <Stat
              label="★4–5の割合"
              value={percent(data.summary.highRate)}
              note={`★1–2の割合 ${percent(data.summary.lowRate)}`}
            />
          </div>
          <p className="report-note">
            これはアプリの利用体験への評価です。reviewsには店舗IDがないため、個別店舗の商品評価としては集計しません。区分は投稿triggerから判定し、未設定・未知のtriggerは「不明」。同じ人の複数投稿も含みます。アンケートの表示確率が区分・triggerで異なるため、投稿件数だけで利用者全体の満足度は比較できません。
          </p>
          <div className="report-chart-grid">
            <RatingPie
              title="ratingの構成比・全体"
              rows={data.ratings}
              context={{ ...context, interval: "期間全体・rating別" }}
              disabled={disabled}
              onRating={selectRating}
            />
            {audiences.map((a) => (
              <RatingPie
                key={a}
                title={`ratingの構成比・${reviewAudienceLabels[a]}`}
                rows={data.audienceRatings.filter((r) => r.audience === a)}
                context={{
                  ...context,
                  interval: "期間全体・rating別",
                  conditions: `${context.conditions}; 円グラフ区分=${reviewAudienceLabels[a]}`,
                }}
                disabled={disabled}
                onRating={(rating) => selectRating(rating, a)}
              />
            ))}
          </div>
          <Panel
            title="店舗側・ゲスト側の比較"
            note="平均・中央値は各区分の元のレビューから算出。0件の区分は「—」。"
          >
            <ReportTable
              rows={data.audiences}
              columns={[{ key: "name", label: "区分（trigger基準）" }, ...statsColumns]}
              label="区分"
              nameKey="name"
              initialSort="count"
              csvName="isc-fes-review-audiences.csv"
              disabled={disabled}
            />
          </Panel>
          <div className="report-section-heading">
            <div>
              <span className="section-number">02</span>
              <h2>いつ、どの画面から届いたか</h2>
            </div>
            <span>投稿日時で区切って比較</span>
          </div>
          <SeriesChart
            title={trend === "count" ? "区分別レビュー件数の推移" : "区分別ratingの推移"}
            note="レビュー投稿時刻の区間ごとに集計。0件の区間のratingは欠測。"
            points={points}
            unit={trend === "count" ? "件" : "評価"}
            context={context}
            disabled={disabled}
            controls={
              <label>
                統計量
                <select
                  aria-label="レビュー推移の統計量"
                  value={trend}
                  onChange={(e) => setTrend(e.target.value as typeof trend)}
                >
                  <option value="both">平均と中央値</option>
                  <option value="average">平均</option>
                  <option value="median">中央値</option>
                  <option value="count">レビュー件数</option>
                </select>
              </label>
            }
          />
          <Panel
            title="triggerごとの統計"
            note="注文手続き完了と受け取り完了は別のtriggerです。不明のtriggerも元の文字列で確認できます。"
          >
            <ReportTable
              rows={triggerRows}
              columns={[
                { key: "name", label: "きっかけ" },
                { key: "triggerCode", label: "trigger" },
                { key: "audienceName", label: "区分" },
                ...statsColumns,
              ]}
              label="きっかけ"
              nameKey="name"
              initialSort="count"
              csvName="isc-fes-review-triggers.csv"
              disabled={disabled}
            />
          </Panel>
          <div className="report-section-heading">
            <div>
              <span className="section-number">03</span>
              <h2>届いたレビュー</h2>
            </div>
            <span>新しい順・50件ずつ</span>
          </div>
          <Panel
            title="コメントとrating"
            note="CSVは1行1レビュー。「レビュー元」列に店舗側・ゲスト側・不明を含め、現在の条件に一致する投稿を全ページ分出力します。両側をまとめる場合は区分を「すべて」にしてください。Notionでは「名前」をタイトル、「レビュー元」をセレクト、「rating」を数値に設定します。ゲストID・アカウントIDは含めません。"
            action={reviewExport}
          >
            <div className="review-list">
              {data.reviews.map((r) => (
                <article className="review-card" key={r.key}>
                  <div className="review-card-heading">
                    <div>
                      <span className={`review-audience review-audience-${r.audience}`}>
                        {reviewAudienceLabels[r.audience]}
                      </span>
                      <time dateTime={r.createdAt}>{r.createdLabel} JST</time>
                    </div>
                    <span className="review-stars" aria-label={`rating ${r.rating} / 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={13}
                          fill={n <= r.rating ? "currentColor" : "none"}
                          style={{ opacity: n <= r.rating ? 1 : 0.25 }}
                        />
                      ))}
                      <strong>{r.rating}</strong>
                    </span>
                  </div>
                  <p className={r.comment ? "review-comment" : "review-no-comment"}>
                    {r.comment ?? "コメントなし（ratingのみ）"}
                  </p>
                  <p className="review-trigger">
                    {reviewTriggerName(r.trigger)}
                    <code>{r.trigger ?? "trigger未設定"}</code>
                  </p>
                </article>
              ))}
              {!data.reviews.length && (
                <div className="report-chart-empty">この条件のレビューはありません。</div>
              )}
            </div>
            <div className="pagination">
              <span>
                {data.summary.count
                  ? `${integer(data.page * data.pageSize + 1)}–${integer(Math.min(data.summary.count, (data.page + 1) * data.pageSize))}`
                  : "0"}{" "}
                / {integer(data.summary.count)}件
              </span>
              <div>
                <button
                  disabled={disabled || data.page === 0}
                  onClick={() => update("page", data.page - 1)}
                >
                  前へ
                </button>
                <button
                  disabled={disabled || (data.page + 1) * data.pageSize >= data.summary.count}
                  onClick={() => update("page", data.page + 1)}
                >
                  次へ
                </button>
              </div>
            </div>
          </Panel>
        </>
      )}
    </ReportFrame>
  );
}
