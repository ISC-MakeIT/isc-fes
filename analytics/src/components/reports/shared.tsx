"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  BarChart3,
  ChevronRight,
  CircleHelp,
  Database,
  Download,
  FlaskConical,
  House,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Search,
  Store,
  Users,
  X,
} from "lucide-react";
import type { ChartPoint, Metadata } from "@/lib/types";
import { inputToISO, jstInput } from "@/lib/filters";
import { integer } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { notionChartRows, type ExportContext } from "@/lib/chart-data";

export const intervalLabels = {
  "5m": "5分ごと",
  "15m": "15分ごと",
  "30m": "30分ごと",
  "1h": "1時間ごと",
  "1d": "1日ごと",
};
export const channelLabels = { all: "すべての受付", mobile: "モバイル", face: "対面受付（推定）" };
export function ReportFrame({
  page,
  filters,
  metadata,
  loading,
  error,
  onRefresh,
  children,
}: {
  page: "home" | "overview" | "stores" | "guests" | "reviews";
  filters: { start: string; end: string; interval: string } | null;
  metadata: Metadata | null;
  loading: boolean;
  error: string | null;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  const [help, setHelp] = useState(false);
  const query = filters
    ? `?${new URLSearchParams({ start: filters.start, end: filters.end, interval: filters.interval })}`
    : "";
  const guest = page === "guests";
  const review = page === "reviews";
  const overview = page === "overview";
  const home = page === "home";
  const pageTitle = home
    ? "ホーム"
    : overview
      ? "全体分析"
      : review
        ? "レビュー分析"
        : guest
          ? "ゲスト分析"
          : "店舗分析";
  return (
    <div className="app-shell report-page">
      <aside className="sidebar">
        <Link className="brand" href={`/${query}`} aria-label="ISC FES Analytics ホーム">
          <span className="brand-mark">
            <BarChart3 size={23} />
          </span>
          <span>
            ISC FES<span className="brand-sub">ANALYTICS / 2026</span>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">祭</span>
          <div>
            <strong>学園祭 2026</strong>
            <small>情報科学専門学校</small>
          </div>
          <span className="workspace-tag">LOCAL</span>
        </div>
        <p className="nav-label">ANALYZE</p>
        <nav aria-label="分析メニュー">
          <Link
            href={`/${query}`}
            className={`nav-item ${home ? "active" : ""}`}
            aria-current={home ? "page" : undefined}
            aria-label="ホーム"
          >
            <House size={18} />
            <span>ホーム</span>
            {home && <ChevronRight size={14} />}
          </Link>
          <Link
            href={`/overview${query}`}
            className={`nav-item ${overview ? "active" : ""}`}
            aria-current={overview ? "page" : undefined}
            aria-label="全体分析"
          >
            <BarChart3 size={18} />
            <span>全体分析</span>
            {overview && <ChevronRight size={14} />}
          </Link>
          <Link
            href={`/stores${query}`}
            className={`nav-item ${page === "stores" ? "active" : ""}`}
            aria-current={page === "stores" ? "page" : undefined}
            aria-label="店舗分析"
          >
            <Store size={18} />
            <span>店舗分析</span>
            {page === "stores" && <ChevronRight size={14} />}
          </Link>
          <Link
            href={`/guests${query}`}
            className={`nav-item ${guest ? "active" : ""}`}
            aria-current={guest ? "page" : undefined}
            aria-label="ゲスト分析"
          >
            <Users size={18} />
            <span>ゲスト分析</span>
            {guest && <ChevronRight size={14} />}
          </Link>
          <Link
            href={`/reviews${query}`}
            className={`nav-item ${review ? "active" : ""}`}
            aria-current={review ? "page" : undefined}
            aria-label="レビュー分析"
          >
            <MessageSquare size={18} />
            <span>レビュー分析</span>
            {review && <ChevronRight size={14} />}
          </Link>
          <Link className="nav-item advanced-link" href={`/advanced${query}`} aria-label="詳細分析">
            <FlaskConical size={18} />
            <span>混雑度・詳細分析</span>
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <Database size={17} />
            <strong>数字から、次のヒントへ。</strong>
            <p>
              お店の動き、ゲストの体験。
              <br />
              届いた声とともに振り返る。
            </p>
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            Notion CSVの使い方
          </button>
          <div className="sidebar-footer">
            <span className="green-dot" />
            LOCAL WORKSPACE<span>2026</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            ワークスペース
            <ChevronRight size={13} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="connection">
            <span className="green-dot" />
            {home
              ? "LOCAL WORKSPACE"
              : error
                ? "接続・集計を確認"
                : metadata
                  ? "PostgreSQL 接続済み"
                  : "接続を確認中"}
            <span className="connection-divider" />
            読み取り専用
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {home
                  ? "YOUR ANALYTICS WORKSPACE"
                  : overview
                    ? "FESTIVAL OVERVIEW"
                    : review
                      ? "REVIEW INSIGHTS"
                      : guest
                        ? "GUEST EXPERIENCE"
                        : "STORE PERFORMANCE"}{" "}
                <span>2026</span>
              </p>
              <h1>
                {home
                  ? "学園祭の振り返りを、ここから。"
                  : overview
                    ? "学園祭全体の動きを、ひと目で。"
                    : review
                      ? "届いた声から、体験を見直す。"
                      : guest
                        ? "ゲストの体験を、数字から。"
                        : "お店の動きを、時間で見比べる。"}
              </h1>
              <p className="page-subtitle">
                {home
                  ? "全体の動き、お店の運営、ゲストの体験。知りたいことから分析を始めましょう。"
                  : overview
                    ? "全店舗の売上・注文・受付を合算し、累計の推移を振り返ります。"
                    : review
                      ? "ゲストと店舗スタッフの満足度を比較し、コメントから改善のヒントを探します。"
                      : guest
                        ? "登録から購入、そのあとの時間まで。ゲスト単位で学園祭を振り返ります。"
                        : "売上、注文、受け取り。店舗ごとの動きを同じ時間軸で振り返ります。"}
              </p>
            </div>
            <div className="page-actions">
              <button className="button" onClick={() => setHelp(true)}>
                <CircleHelp size={15} />
                Notion CSV
              </button>
              {onRefresh && (
                <button className="button button-dark" onClick={onRefresh} disabled={loading}>
                  <RefreshCw size={15} className={loading ? "spin" : ""} />
                  更新
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <Database size={18} />
              <div>
                <strong>集計を取得できませんでした</strong>
                <p>{error}</p>
                {!metadata && (
                  <p>
                    analytics/.env.local の DATABASE_URL を設定し、pnpm dev で起動してください。
                  </p>
                )}
              </div>
              <button className="button" onClick={onRefresh}>
                再試行
              </button>
            </div>
          )}
          {children}
        </main>
        <footer className="app-footer">
          ISC FES ANALYTICS<span>次の「楽しかった」につなげるデータ。</span>
        </footer>
      </div>
      {help && <NotionHelp close={() => setHelp(false)} />}
    </div>
  );
}
function NotionHelp({ close }: { close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="definitions" onCancel={close}>
      <div className="panel-heading">
        <h2>グラフをNotionで振り返る</h2>
        <button className="icon-button" onClick={close} aria-label="説明を閉じる">
          <X size={20} />
        </button>
      </div>
      <ol className="notion-steps">
        <li>各グラフの「CSV」を押すと、表示中の系列・条件と同じデータを出力します。</li>
        <li>
          NotionでCSVをインポート。先頭の「名前」をタイトル、「日時ラベルJST」「系列」「指標」「単位」をテキスト、「値」「対象件数」を数値として設定します。
        </li>
        <li>
          グラフビューを追加。横軸を「日時ラベルJST」の昇順、縦軸を「値」にします。グループ化が利用できる場合は「系列」を選びます。テキスト型の横軸でグループ化が表示されない場合は、フィルターで1系列に絞って表示してください。分布グラフは先頭番号の昇順に並べます。
        </li>
        <li>
          平均・中央値・率・累計は計算済みです。1点1行なので、同じ指標・集計間隔のまま表示してください。累計のCSVではNotionの「累積」はオフにします。
        </li>
      </ol>
      <p className="inline-note">
        Notionは1グラフ200グループ・50サブグループまで。超える場合は期間や系列を絞るか、集計間隔を大きくしてください。再取込は行の追加になるため、同じデータの重複に注意してください。Freeプランはグラフ1つ、有料プランは複数利用できます。
      </p>
      <p className="notion-links">
        <a href="https://www.notion.com/help/charts" target="_blank" rel="noreferrer">
          Notionのグラフ仕様
        </a>
        <a
          href="https://www.notion.com/help/import-data-into-notion#csv"
          target="_blank"
          rel="noreferrer"
        >
          CSVインポート仕様
        </a>
      </p>
      <button className="button button-green" onClick={close}>
        閉じる
      </button>
    </dialog>
  );
}
export function Panel({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Stat({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={`stat ${accent ? "stat-accent" : ""}`}>
      <div className="stat-top">
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
export function PeriodFields<F extends { start: string; end: string; interval: string }>({
  filters,
  update,
}: {
  filters: F;
  update: <K extends keyof F>(key: K, value: F[K]) => void;
}) {
  return (
    <>
      <label>
        <span>開始日時（JST）</span>
        <input
          type="datetime-local"
          aria-label="開始日時（日本時間）"
          required
          value={jstInput(filters.start)}
          onInput={(e) => {
            if (e.currentTarget.value)
              update("start", inputToISO(e.currentTarget.value) as F["start"]);
          }}
        />
      </label>
      <label>
        <span>終了日時（含まない）</span>
        <input
          type="datetime-local"
          aria-label="終了日時（日本時間）"
          required
          value={jstInput(filters.end)}
          onInput={(e) => {
            if (e.currentTarget.value) update("end", inputToISO(e.currentTarget.value) as F["end"]);
          }}
        />
      </label>
      <label>
        <span>集計間隔</span>
        <select
          value={filters.interval}
          onChange={(e) => update("interval", e.currentTarget.value as F["interval"])}
        >
          {Object.entries(intervalLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
export function ReportStatus({
  loading,
  data,
  issue,
  pending,
}: {
  loading: boolean;
  data: unknown;
  issue: string | null;
  pending: boolean;
}) {
  return (
    <>
      {issue && (
        <p className="error-banner" role="alert">
          {issue}
        </p>
      )}
      {loading && !data ? (
        <div className="loading-state" role="status">
          <LoaderCircle className="spin" size={25} />
          <strong>データを集計しています</strong>
        </div>
      ) : (loading || pending) && data ? (
        <div className="refresh-status" role="status">
          <LoaderCircle className="spin" size={14} />
          条件を反映しています。数値は更新前の結果です。
        </div>
      ) : null}
    </>
  );
}
export function ChartExport({
  points,
  metric,
  unit,
  context,
  disabled,
}: {
  points: ChartPoint[];
  metric: string;
  unit: string;
  context: ExportContext;
  disabled: boolean;
}) {
  return (
    <button
      className="button chart-export"
      disabled={disabled || !points.length}
      onClick={() =>
        downloadCSV(
          notionChartRows(points, metric, unit, context),
          `isc-fes-${metric}-${context.start.slice(0, 10)}.csv`,
        )
      }
      aria-label={`${metric}をCSV出力`}
    >
      <Download size={13} />
      CSV
    </button>
  );
}
export interface TableColumn<T> {
  key: keyof T & string;
  label: string;
  format?: (row: T) => string;
}
export function ReportTable<T extends object>({
  rows,
  columns,
  label,
  nameKey,
  initialSort,
  onSelect,
  csvName,
  disabled = false,
}: {
  rows: T[];
  columns: TableColumn<T>[];
  label: string;
  nameKey: keyof T & string;
  initialSort: keyof T & string;
  onSelect?: (row: T) => void;
  csvName: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(initialSort);
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);
  const filtered = rows
    .filter((row) => String(row[nameKey]).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => {
      const av = a[sort],
        bv = b[sort];
      if (av == null) return bv == null ? String(a[nameKey]).localeCompare(String(b[nameKey])) : 1;
      if (bv == null) return -1;
      const order =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return (ascending ? order : -order) || String(a[nameKey]).localeCompare(String(b[nameKey]));
    });
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 15) - 1));
  return (
    <>
      <div className="table-toolbar">
        <label className="search">
          <Search size={15} />
          <input
            aria-label={`${label}を検索`}
            placeholder={`${label}を検索`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <button
          className="button"
          disabled={disabled || !rows.length}
          onClick={() =>
            downloadCSV(
              [
                columns.map((c) => c.label),
                ...rows.map((row) =>
                  columns.map((c) =>
                    row[c.key] == null
                      ? null
                      : typeof row[c.key] === "number"
                        ? (row[c.key] as number)
                        : String(row[c.key]),
                  ),
                ),
              ],
              csvName,
            )
          }
        >
          <Download size={13} />
          表のCSV
        </button>
      </div>
      <p className="table-scroll-hint">
        <ArrowLeftRight size={14} />
        横スクロール・左端固定・見出しで並べ替え ／ {integer(filtered.length)}件
      </p>
      <div
        className="table-scroll report-table-scroll"
        role="region"
        aria-label={`${label}の統計（横スクロール）`}
        tabIndex={0}
      >
        <table className="report-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  scope="col"
                  key={c.key}
                  aria-sort={sort === c.key ? (ascending ? "ascending" : "descending") : "none"}
                >
                  <button
                    onClick={() => {
                      if (sort === c.key) setAscending(!ascending);
                      else {
                        setSort(c.key);
                        setAscending(false);
                      }
                      setPage(0);
                    }}
                  >
                    {c.label}
                    {sort === c.key &&
                      (ascending ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(safePage * 15, safePage * 15 + 15).map((row, index) => (
              <tr key={String(row[nameKey]) + index}>
                {columns.map((c, i) => (
                  <td key={c.key} title={i === 0 ? String(row[c.key]) : undefined}>
                    {i === 0 && onSelect ? (
                      <button className="table-link" onClick={() => onSelect(row)}>
                        {c.format ? c.format(row) : String(row[c.key])}
                      </button>
                    ) : c.format ? (
                      c.format(row)
                    ) : row[c.key] == null ? (
                      "—"
                    ) : (
                      String(row[c.key])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="table-empty">該当するデータがありません。</p>}
      </div>
      {filtered.length > 15 && (
        <div className="pagination">
          <span>
            {safePage * 15 + 1}–{Math.min(filtered.length, (safePage + 1) * 15)} / {filtered.length}
          </span>
          <div>
            <button disabled={!safePage} onClick={() => setPage(safePage - 1)}>
              前へ
            </button>
            <button
              disabled={(safePage + 1) * 15 >= filtered.length}
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
