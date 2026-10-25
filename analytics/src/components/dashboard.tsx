"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  Download,
  FlaskConical,
  LayoutDashboard,
  LoaderCircle,
  Radio,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { AnalyticsData, Filters, Metadata, MetricRow } from "@/lib/types";
import { defaultFilters, inputToISO, jstInput, parseFilters, toParams } from "@/lib/filters";
import { decimal, integer, minutes, percent, shortDate, statusNames, yen } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import {
  CongestionChart,
  DurationChart,
  metricOptions,
  RateTimeline,
  SimpleChart,
  StatusChart,
  StoreComparison,
  TimelineChart,
  type MetricKey,
} from "./charts";
import { MetricTable } from "./metric-table";

type View = "overview" | "sales" | "orders" | "congestion" | "explorer";
const views = [
  {
    key: "overview" as const,
    label: "概要",
    title: "学園祭を、数字で振り返る。",
    subtitle: "注文から受け取りまで。学園祭の動きをひとつの画面に。",
    icon: LayoutDashboard,
  },
  {
    key: "sales" as const,
    label: "売上・メニュー",
    title: "どのお店で、何が売れた？",
    subtitle: "店舗とメニューを比較して、売上を生んだ動きを探ります。",
    icon: TrendingUp,
  },
  {
    key: "orders" as const,
    label: "注文・受付",
    title: "注文の流れを、ひも解く。",
    subtitle: "待ち時間やキャンセル、受付方法から運営を振り返ります。",
    icon: ShoppingBag,
  },
  {
    key: "congestion" as const,
    label: "混雑度の検証",
    title: "「混んでいる」を確かめる。",
    subtitle: "入力された混雑度と、注文から推定した混雑度を比較します。",
    icon: Radio,
  },
  {
    key: "explorer" as const,
    label: "エクスプローラー",
    title: "もう一歩、データの奥へ。",
    subtitle: "指標と切り口を組み合わせて、自分だけの問いを探ります。",
    icon: FlaskConical,
  },
];
const intervalNames = {
  "5m": "5分ごと",
  "15m": "15分ごと",
  "30m": "30分ごと",
  "1h": "1時間ごと",
  "1d": "1日ごと",
};
const salesNames = { completed: "受取完了のみ", accepted: "キャンセル以外", all: "すべての注文" };
const groupNames = {
  timeline: "時系列",
  stores: "店舗別",
  menus: "メニュー別",
  channels: "受付方法別",
  statuses: "注文状態別",
  hours: "時間帯別（JST）",
  weekdays: "曜日別（JST）",
};
type Group = keyof typeof groupNames;

function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Stat({
  label,
  value,
  note,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`stat ${accent ? "stat-accent" : ""}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <Database size={30} />
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
async function fetchJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { cache: "no-store", signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "データの読み込みに失敗しました。");
  return body;
}
function displayRows(data: AnalyticsData, group: Group): MetricRow[] {
  return data[group].map((r) =>
    group === "statuses" ? { ...r, name: statusNames[r.key] ?? r.name } : r,
  );
}

export default function Dashboard() {
  const [view, setView] = useState<View>("overview");
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [draft, setDraft] = useState<Filters | null>(null);
  const [applied, setApplied] = useState<Filters | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterIssue, setFilterIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [definitions, setDefinitions] = useState(false);
  const [metric, setMetric] = useState<MetricKey>("orders");
  const [group, setGroup] = useState<Group>("timeline");
  const [kind, setKind] = useState<"bar" | "line" | "area">("bar");
  const [compare, setCompare] = useState(false);
  const [salesGroup, setSalesGroup] = useState<"stores" | "menus">("stores");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (definitions) dialogRef.current?.showModal();
  }, [definitions]);

  const bootstrap = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const meta = await fetchJSON<Metadata>("/api/metadata", signal);
      setMetadata(meta);
      let filters = defaultFilters(meta.firstOrder, meta.lastOrder);
      const query = new URLSearchParams(window.location.search);
      if (query.has("start")) {
        try {
          filters = parseFilters(query);
        } catch (e) {
          setError((e as Error).message);
        }
      }
      const initialView = query.get("view");
      if (views.some((v) => v.key === initialView)) setView(initialView as View);
      setDraft(filters);
      setApplied(filters);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
        setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void bootstrap(controller.signal);
    return () => controller.abort();
  }, [bootstrap]);
  useEffect(() => {
    if (!draft) return;
    let valid: Filters;
    try {
      valid = parseFilters(toParams(draft));
      setFilterIssue(null);
    } catch (error) {
      setFilterIssue((error as Error).message);
      return;
    }
    if (applied && toParams(valid).toString() === toParams(applied).toString()) return;
    // Coalesce consecutive edits so dependent selectors and dates can be changed together.
    const timeout = window.setTimeout(() => {
      setApplied(valid);
      setError(null);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [draft, applied]);
  useEffect(() => {
    if (!applied) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchJSON<AnalyticsData>(`/api/analytics?${toParams(applied)}`, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [applied, revision]);
  useEffect(() => {
    if (!applied) return;
    const query = toParams(applied);
    query.set("view", view);
    window.history.replaceState(null, "", `?${query}`);
  }, [applied, view]);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((f) => (f ? { ...f, [key]: value, ...(key === "store" ? { menu: "" } : {}) } : f));
  const apply = (filters = draft) => {
    if (!filters) return;
    try {
      const valid = parseFilters(toParams(filters));
      setApplied(valid);
      setDraft(valid);
      setRevision((n) => n + 1);
      setFilterIssue(null);
      setError(null);
    } catch (e) {
      setFilterIssue((e as Error).message);
    }
  };
  const selectStore = (id: string) => {
    if (draft) {
      apply({ ...draft, store: id, menu: "" });
      setView("sales");
    }
  };
  const refresh = async () => {
    if (!metadata) {
      await bootstrap();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMetadata(await fetchJSON<Metadata>("/api/metadata"));
      setRevision((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };
  const current = views.find((v) => v.key === view)!;
  const dirty = draft && applied && toParams(draft).toString() !== toParams(applied).toString();
  const exportGroup: Group =
    view === "sales"
      ? salesGroup
      : view === "orders"
        ? "stores"
        : view === "explorer"
          ? group
          : "timeline";
  const exportCSV = () => {
    if (!data) return;
    const f = data.filters;
    const preface: (string | number | null)[][] = [
      ["期間開始（含む）", f.start],
      ["期間終了（含まない）", f.end],
      ["店舗ID", f.store || "すべて"],
      ["メニューID", f.menu || "すべて"],
      ["注文状態", f.status],
      ["受付", f.channel],
      ["売上対象", salesNames[f.sales]],
      ["集計単位", f.interval],
      ["集計時刻", data.generatedAt],
    ];
    const rows =
      view === "congestion"
        ? [
            ...preface,
            ["推定基準", f.congestionMetric],
            ["中しきい値", f.low],
            ["高しきい値", f.high],
            [
              "区間開始",
              "店舗ID",
              "店舗",
              "入力混雑度",
              "推定混雑度",
              "差（推定−入力）",
              "未調理注文数",
              "未完了注文数",
              "区間内注文数",
            ],
            ...data.congestion.map((r) => [
              r.at,
              r.storeId,
              r.storeName,
              r.reported,
              r.inferred,
              r.gap,
              r.preparing,
              r.active,
              r.arrivals,
            ]),
          ]
        : [
            ...preface,
            ["切り口", groupNames[exportGroup]],
            [
              "ID・区間開始",
              "名称",
              "注文数",
              "調理中件数",
              "受取待ち件数",
              "受取完了数",
              "キャンセル数",
              "対面受付数（推定）",
              "利用ゲスト数",
              "売上（円）",
              "販売点数",
              "キャンセル率（%）",
              "対面受付率（%）",
              "平均単価（円）",
              "平均完了時間（分）",
              "完了時間 中央値（分）",
              "完了時間 P90（分）",
              "平均調理時間（分）",
              "調理時間 中央値（分）",
              "調理時間 P90（分）",
              "調理時間の対象件数",
              "平均受取待ち（分）",
              "受取待ち時間 中央値（分）",
              "受取待ち時間 P90（分）",
              "受取待ち時間の対象件数",
              "平均キャンセル待ち（分）",
              "売上対象の注文件数",
            ],
            ...displayRows(data, exportGroup).map((r) => [
              r.key,
              r.name,
              r.orders,
              r.pending,
              r.ready,
              r.completed,
              r.cancelled,
              r.face,
              r.guests,
              r.revenue,
              r.units,
              r.cancellationRate,
              r.faceRate,
              r.averageAmount,
              r.averageMinutes,
              r.medianMinutes,
              r.p90Minutes,
              r.preparationMinutes,
              r.preparationMedianMinutes,
              r.preparationP90Minutes,
              r.preparationSamples,
              r.pickupMinutes,
              r.pickupMedianMinutes,
              r.pickupP90Minutes,
              r.pickupSamples,
              r.cancellationWaitMinutes,
              r.salesOrders,
            ]),
          ];
    downloadCSV(
      rows,
      `isc-fes-${view === "congestion" ? "congestion" : exportGroup}-${jstInput(f.start).slice(0, 10)}.csv`,
    );
  };
  const summary = data?.summary;
  const known = data?.congestion.filter((r) => r.reported !== null) ?? [];
  const matched = known.filter((r) => r.gap === 0).length;
  const meanGap = known.length
    ? known.reduce((sum, r) => sum + Math.abs(r.gap!), 0) / known.length
    : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="ISC FES Analytics ホーム">
          <span className="brand-mark">
            <BarChart3 size={23} strokeWidth={2.3} />
          </span>
          <span>
            ISC FES<span className="brand-sub">ANALYTICS / 2026</span>
          </span>
        </a>
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
          {views.map((v) => (
            <button
              aria-label={v.label}
              key={v.key}
              className={`nav-item ${view === v.key ? "active" : ""}`}
              onClick={() => setView(v.key)}
              aria-current={view === v.key ? "page" : undefined}
            >
              <v.icon size={18} />
              <span>{v.label}</span>
              {view === v.key && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <Database size={17} />
            <strong>ローカルで、じっくり。</strong>
            <p>
              期間後の振り返りも、
              <br />
              次の学園祭へのヒントも。
            </p>
          </div>
          <button className="help-button" onClick={() => setDefinitions(true)}>
            <CircleHelp size={17} />
            指標の定義・使い方
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-footer">
            <span className="green-dot" />
            LOCAL WORKSPACE<span>v0.1</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            ワークスペース
            <ChevronRight size={13} />
            <strong>{current.label}</strong>
          </div>
          <div className={`connection ${metadata ? "" : "disconnected"}`}>
            <span className="green-dot" />
            {metadata ? "PostgreSQL 接続済み" : "DB 接続を確認中"}
            <span className="connection-divider" />
            読み取り専用
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                FESTIVAL INSIGHTS <span>2026</span>
              </p>
              <h1>{current.title}</h1>
              <p className="page-subtitle">{current.subtitle}</p>
            </div>
            <div className="page-actions">
              <button
                className="button"
                onClick={refresh}
                disabled={loading}
                aria-label="データを再取得"
              >
                <RefreshCw size={15} className={loading ? "spin" : ""} />
                更新
              </button>
              <button
                className="button button-dark"
                onClick={exportCSV}
                disabled={!data || loading || !!error || !!dirty}
              >
                <Download size={15} />
                CSV を出力
              </button>
            </div>
          </div>
          {draft && (
            <form
              className="filter-panel"
              onSubmit={(e) => {
                e.preventDefault();
                apply();
              }}
            >
              <div className="filter-primary">
                <label className="date-field">
                  <span>
                    <CalendarDays size={13} />
                    開始日時
                  </span>
                  <input
                    aria-label="開始日時（日本時間）"
                    type="datetime-local"
                    required
                    value={jstInput(draft.start)}
                    onInput={(e) => {
                      if (e.currentTarget.value) update("start", inputToISO(e.currentTarget.value));
                    }}
                  />
                </label>
                <span className="date-arrow">→</span>
                <label className="date-field">
                  <span>終了日時（含まない）</span>
                  <input
                    aria-label="終了日時（日本時間）"
                    type="datetime-local"
                    required
                    value={jstInput(draft.end)}
                    onInput={(e) => {
                      if (e.currentTarget.value) update("end", inputToISO(e.currentTarget.value));
                    }}
                  />
                </label>
                <div className="filter-divider" />
                <label>
                  <span>店舗</span>
                  <select value={draft.store} onChange={(e) => update("store", e.target.value)}>
                    <option value="">すべての店舗</option>
                    {metadata?.stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>集計単位</span>
                  <select
                    value={draft.interval}
                    onChange={(e) => update("interval", e.target.value as Filters["interval"])}
                  >
                    {Object.entries(intervalNames).map(([v, name]) => (
                      <option key={v} value={v}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className={`button filter-toggle ${advanced ? "selected" : ""}`}
                  onClick={() => setAdvanced(!advanced)}
                  aria-expanded={advanced}
                >
                  <SlidersHorizontal size={15} />
                  詳細条件
                </button>
                <button className="button button-green" type="submit" disabled={loading}>
                  再集計
                  <ArrowRight size={14} />
                </button>
              </div>
              {advanced && (
                <div className="filter-advanced">
                  <label>
                    <span>メニュー</span>
                    <select value={draft.menu} onChange={(e) => update("menu", e.target.value)}>
                      <option value="">すべてのメニュー</option>
                      {metadata?.menus
                        .filter((m) => !draft.store || m.storeId === draft.store)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} / {metadata.stores.find((s) => s.id === m.storeId)?.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    <span>注文状態</span>
                    <select
                      value={draft.status}
                      onChange={(e) => update("status", e.target.value as Filters["status"])}
                    >
                      <option value="all">すべての状態</option>
                      {Object.entries(statusNames).map(([v, name]) => (
                        <option key={v} value={v}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>受付方法</span>
                    <select
                      value={draft.channel}
                      onChange={(e) => update("channel", e.target.value as Filters["channel"])}
                    >
                      <option value="all">すべての受付</option>
                      <option value="mobile">モバイル</option>
                      <option value="face">対面受付（推定）</option>
                    </select>
                  </label>
                  <label>
                    <span>売上の対象</span>
                    <select
                      value={draft.sales}
                      onChange={(e) => update("sales", e.target.value as Filters["sales"])}
                    >
                      {Object.entries(salesNames).map(([v, name]) => (
                        <option key={v} value={v}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      if (metadata) {
                        const f = defaultFilters(metadata.firstOrder, metadata.lastOrder);
                        setDraft(f);
                      }
                    }}
                  >
                    条件をリセット
                  </button>
                </div>
              )}
              <div className="filter-foot">
                <span>条件変更で自動再集計 · 日本時間（JST）・注文作成日時で抽出</span>
                <span
                  role={filterIssue ? "alert" : undefined}
                  className={filterIssue ? "filter-issue" : undefined}
                >
                  {filterIssue
                    ? filterIssue
                    : loading
                      ? "再集計中…"
                      : dirty
                        ? "条件の変更を反映しています…"
                        : applied
                          ? `売上：${salesNames[applied.sales]}${applied.menu ? " ／ 選択メニューの明細金額のみ" : ""}`
                          : ""}
                </span>
              </div>
            </form>
          )}
          {loading && data && (
            <div className="refresh-status" role="status" aria-live="polite">
              <LoaderCircle size={14} className="spin" />
              選択した条件で再集計しています。表示中の数値は更新前の結果です。
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <Database size={18} />
              <div>
                <strong>データを取得できませんでした</strong>
                <p>{error}</p>
              </div>
              <button className="button" onClick={refresh}>
                再試行
              </button>
            </div>
          )}
          {!metadata && !loading && (
            <section className="panel setup">
              <Empty title="ローカル DB を接続しましょう">
                接続情報を設定すると、既存の注文データから集計を始めます。
              </Empty>
              <pre>
                cd analytics{"\n"}cp .env.example .env.local{"\n"}# DATABASE_URL
                を編集して、開発サーバーを再起動{"\n"}pnpm dev
              </pre>
              <p>既存アプリの DB をそのまま参照します。データの書き込みは行いません。</p>
            </section>
          )}
          {loading && !data ? (
            <div className="loading-state" role="status">
              <LoaderCircle size={26} className="spin" />
              <strong>データを集計しています</strong>
              <span>同じ時点の DB から、指標を計算しています。</span>
            </div>
          ) : (
            data &&
            !error && (
              <>
                {view !== "congestion" && (
                  <div className="stats-grid">
                    <Stat
                      label="売上合計"
                      value={yen(summary!.revenue)}
                      note={`${integer(summary!.units)}点販売 · ${integer(summary!.salesOrders)}件`}
                      icon={<TrendingUp size={17} />}
                      accent
                    />
                    <Stat
                      label="注文数"
                      value={integer(summary!.orders)}
                      note={`${integer(summary!.guests)}ゲスト · 完了 ${integer(summary!.completed)}件`}
                      icon={<ShoppingBag size={17} />}
                    />
                    <Stat
                      label="キャンセル率"
                      value={percent(summary!.cancellationRate)}
                      note={`${integer(summary!.cancelled)}件 / ${integer(summary!.orders)}件`}
                      icon={<ArrowDownRight size={17} />}
                    />
                    <Stat
                      label="平均完了時間"
                      value={minutes(summary!.averageMinutes)}
                      note={`中央値 ${minutes(summary!.medianMinutes)} · 完了分のみ`}
                      icon={<Clock3 size={17} />}
                    />
                    <Stat
                      label="対面受付率¹"
                      value={percent(summary!.faceRate)}
                      note={`${integer(summary!.face)}件 · スタッフ代理注文から推定`}
                      icon={<Users size={17} />}
                    />
                  </div>
                )}
                {data.summary.orders === 0 && view !== "congestion" && (
                  <div className="info-banner">
                    <CircleHelp size={17} />
                    この条件に一致する注文はありません。期間や詳細条件を変更してください。率と時間の「—」は対象データなしを表します。
                  </div>
                )}
                {view === "overview" && (
                  <>
                    <Panel
                      title="注文と売上の推移"
                      subtitle={`${intervalNames[data.filters.interval]}の動き · 売上は注文作成時刻に帰属`}
                      action={
                        <span className="pill">
                          <span className="green-dot" />
                          {intervalNames[data.filters.interval]}
                        </span>
                      }
                    >
                      <TimelineChart data={data.timeline} />
                    </Panel>
                    <div className="two-columns">
                      <Panel title="注文の内訳" subtitle="現在の注文状態">
                        <StatusChart data={data.statuses} total={summary!.orders} />
                      </Panel>
                      <Panel title="受け取りまでの時間" subtitle="区間内に作成された注文の所要時間">
                        <DurationChart data={data.timeline} />
                      </Panel>
                    </div>
                    <div className="two-columns ranking-grid">
                      <Panel
                        title="店舗別の売上"
                        subtitle="売上順 · 店舗名から絞り込み"
                        action={
                          <button className="text-button" onClick={() => setView("sales")}>
                            すべて見る
                            <ArrowRight size={14} />
                          </button>
                        }
                      >
                        <MetricTable rows={data.stores} compact onSelect={selectStore} />
                      </Panel>
                      <Panel title="時間帯ごとの注文" subtitle="期間内の各日を合算 · 日本時間">
                        <SimpleChart data={data.hours} />
                      </Panel>
                    </div>
                  </>
                )}
                {view === "sales" && (
                  <>
                    <div className="two-columns">
                      <Panel title="売上の推移" subtitle="選択した売上対象とメニューで集計">
                        <SimpleChart data={data.timeline} metric="revenue" kind="area" />
                      </Panel>
                      <Panel
                        title="販売点数の推移"
                        subtitle={`平均注文単価 ${summary!.averageAmount == null ? "—" : yen(summary!.averageAmount)}`}
                      >
                        <SimpleChart data={data.timeline} metric="units" />
                      </Panel>
                    </div>
                    <Panel
                      title="売上ランキング"
                      subtitle="メニュー金額には注文時のトッピング代を含みます"
                      action={
                        <div className="segmented">
                          <button
                            className={salesGroup === "stores" ? "active" : ""}
                            onClick={() => setSalesGroup("stores")}
                          >
                            店舗別
                          </button>
                          <button
                            className={salesGroup === "menus" ? "active" : ""}
                            onClick={() => setSalesGroup("menus")}
                          >
                            メニュー別
                          </button>
                        </div>
                      }
                    >
                      <MetricTable
                        rows={data[salesGroup]}
                        label={salesGroup === "stores" ? "店舗" : "メニュー / 店舗"}
                        onSelect={
                          salesGroup === "stores"
                            ? selectStore
                            : (id) => {
                                if (draft) apply({ ...draft, menu: id });
                              }
                        }
                      />
                    </Panel>
                  </>
                )}
                {view === "orders" && (
                  <>
                    <div className="two-columns">
                      <Panel
                        title="キャンセル率・対面受付率"
                        subtitle="各区間の作成注文数を分母に計算"
                      >
                        <RateTimeline data={data.timeline} />
                      </Panel>
                      <Panel
                        title="完了時間の分布"
                        subtitle={`受取完了 ${integer(summary!.completed)}件 · P90 ${minutes(summary!.p90Minutes)}`}
                      >
                        <SimpleChart data={data.durations} />
                      </Panel>
                    </div>
                    <div className="two-columns">
                      <Panel title="調理・受取待ち時間の推移" subtitle="未到達の時刻は集計対象外">
                        <DurationChart data={data.timeline} />
                      </Panel>
                      <Panel
                        title="受付方法の内訳"
                        subtitle="¹ スタッフ／管理者の件数制限免除を対面受付と推定"
                      >
                        <div className="channel-cards">
                          {["mobile", "face"].map((key, i) => {
                            const row = data.channels.find((r) => r.key === key);
                            return (
                              <div key={key}>
                                <span className={`channel-icon ${i ? "gold" : ""}`}>
                                  {i ? <Store size={21} /> : <ShoppingBag size={21} />}
                                </span>
                                <span>
                                  {i ? "対面受付（推定）" : "モバイル"}
                                  <strong>
                                    {integer(row?.orders ?? 0)}
                                    <small>件</small>
                                  </strong>
                                </span>
                                <b>
                                  {summary!.orders
                                    ? percent(((row?.orders ?? 0) / summary!.orders) * 100)
                                    : "—"}
                                </b>
                              </div>
                            );
                          })}
                        </div>
                        <div className="inline-note">
                          平均キャンセル待ち時間：{minutes(summary!.cancellationWaitMinutes)}
                          <br />
                          調理完了からキャンセルになるまでの時間です。
                        </div>
                      </Panel>
                    </div>
                    <Panel
                      title="店舗ごとの注文・受付"
                      subtitle="調理・受取待ち・完了時間の平均 / 中央値 / P90を比較。対象件数は各時刻に到達した注文数"
                    >
                      <MetricTable rows={data.stores} operations onSelect={selectStore} />
                    </Panel>
                  </>
                )}
                {view === "congestion" && (
                  <>
                    <div className="info-banner">
                      <CircleHelp size={17} />
                      <span>
                        注文数による<strong>推定値</strong>
                        です。実際の行列やスタッフ数は計測していません。店舗・期間・集計単位を適用し、メニュー・受付・注文状態の条件は使いません。
                      </span>
                    </div>
                    <Panel
                      title="推定の条件"
                      subtitle="中・高の境界を調整し、運営の実感と照らし合わせます"
                    >
                      <form
                        className="congestion-controls"
                        onSubmit={(e) => {
                          e.preventDefault();
                          apply();
                        }}
                      >
                        <label>
                          推定に使う値
                          <select
                            value={draft!.congestionMetric}
                            onChange={(e) =>
                              update(
                                "congestionMetric",
                                e.target.value as Filters["congestionMetric"],
                              )
                            }
                          >
                            <option value="preparing">区間終了時の未調理注文数</option>
                            <option value="active">区間終了時の未完了注文数</option>
                            <option value="arrivals">区間内の新規注文数</option>
                          </select>
                        </label>
                        <label>
                          混雑度2の下限
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            required
                            value={draft!.low}
                            onChange={(e) => update("low", Number(e.target.value))}
                          />
                        </label>
                        <label>
                          混雑度3の下限
                          <input
                            type="number"
                            min={1}
                            max={10000}
                            required
                            value={draft!.high}
                            onChange={(e) => update("high", Number(e.target.value))}
                          />
                        </label>
                        <button className="button button-green">
                          再集計
                          <ArrowRight size={14} />
                        </button>
                        <p>
                          混雑度1：{data.filters.low}件未満 ／ 2：{data.filters.low}〜
                          {data.filters.high - 1}件 ／ 3：{data.filters.high}件以上
                        </p>
                      </form>
                    </Panel>
                    <div className="stats-grid congestion-stats">
                      <Stat
                        label="入力値との一致率"
                        value={known.length ? percent((matched / known.length) * 100) : "—"}
                        note={`${integer(matched)} / ${integer(known.length)}店舗・区間`}
                        icon={<Activity size={17} />}
                        accent
                      />
                      <Stat
                        label="平均絶対誤差"
                        value={decimal(meanGap, 2)}
                        note="|推定混雑度 − 入力混雑度| の平均"
                        icon={<SlidersHorizontal size={17} />}
                      />
                      <Stat
                        label="入力履歴のカバー率"
                        value={
                          data.congestion.length
                            ? percent((known.length / data.congestion.length) * 100)
                            : "—"
                        }
                        note={`${integer(known.length)} / ${integer(data.congestion.length)}店舗・区間`}
                        icon={<Database size={17} />}
                      />
                    </div>
                    {!data.hasActivityLog && (
                      <div className="info-banner">
                        activity_log がないため入力混雑度は比較できません。推定値のみ表示します。
                      </div>
                    )}
                    <Panel
                      title="入力と推定の比較"
                      subtitle="1＝空いている ／ 2＝やや混雑 ／ 3＝混雑"
                    >
                      <CongestionChart data={data} />
                    </Panel>
                    <Panel
                      title="店舗別の乖離"
                      subtitle="履歴のある区間を等しい重みで比較。推定が大きいと「過小申告」、小さいと「過大申告」"
                    >
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>店舗</th>
                              <th>比較区間</th>
                              <th>一致率</th>
                              <th>平均絶対誤差</th>
                              <th>過小申告区間</th>
                              <th>過大申告区間</th>
                              <th>入力履歴なし</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(
                              new Map(data.congestion.map((r) => [r.storeId, r.storeName])),
                            ).map(([id, name]) => {
                              const all = data.congestion.filter((r) => r.storeId === id),
                                rows = all.filter((r) => r.reported !== null);
                              return (
                                <tr key={id}>
                                  <td className="name-cell">{name}</td>
                                  <td>{rows.length}</td>
                                  <td>
                                    {rows.length
                                      ? percent(
                                          (rows.filter((r) => r.gap === 0).length / rows.length) *
                                            100,
                                        )
                                      : "—"}
                                  </td>
                                  <td>
                                    {rows.length
                                      ? decimal(
                                          rows.reduce((n, r) => n + Math.abs(r.gap!), 0) /
                                            rows.length,
                                          2,
                                        )
                                      : "—"}
                                  </td>
                                  <td>{rows.filter((r) => r.gap! > 0).length}</td>
                                  <td>{rows.filter((r) => r.gap! < 0).length}</td>
                                  <td>{all.length - rows.length}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                  </>
                )}
                {view === "explorer" && (
                  <>
                    <Panel
                      title="分析を組み立てる"
                      subtitle="指標・切り口・グラフを自由に組み合わせられます"
                    >
                      <div className="explorer-controls">
                        <label>
                          指標
                          <select
                            value={metric}
                            onChange={(e) => setMetric(e.target.value as MetricKey)}
                          >
                            {metricOptions.map((m) => (
                              <option key={m.key} value={m.key}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          切り口
                          <select value={group} onChange={(e) => setGroup(e.target.value as Group)}>
                            {Object.entries(groupNames).map(([key, name]) => (
                              <option key={key} value={key}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          グラフ
                          <select
                            value={kind}
                            onChange={(e) => setKind(e.target.value as typeof kind)}
                          >
                            <option value="bar">棒グラフ</option>
                            <option value="line">折れ線</option>
                            <option value="area">面グラフ</option>
                          </select>
                        </label>
                        {group === "timeline" && (
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={compare}
                              onChange={(e) => setCompare(e.target.checked)}
                            />
                            店舗を比較
                          </label>
                        )}
                      </div>
                    </Panel>
                    <Panel
                      title={`${metricOptions.find((m) => m.key === metric)!.label} × ${groupNames[group]}`}
                      subtitle={
                        group === "menus"
                          ? "グラフは上位20件。全件を下の表とCSVで確認できます。"
                          : "注文のない区間の率・時間は「—」として扱います。"
                      }
                    >
                      {group === "timeline" && compare ? (
                        <StoreComparison data={data} metric={metric} />
                      ) : (
                        <SimpleChart
                          data={
                            group === "menus"
                              ? [...displayRows(data, group)]
                                  .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
                                  .slice(0, 20)
                              : displayRows(data, group)
                          }
                          metric={metric}
                          kind={kind}
                        />
                      )}
                    </Panel>
                    <Panel
                      title="集計データ"
                      subtitle="CSV に現在の切り口の全件と適用条件を出力できます"
                    >
                      <MetricTable
                        key={group}
                        operations
                        rows={displayRows(data, group)}
                        label={groupNames[group]}
                      />
                    </Panel>
                  </>
                )}
                <div className="data-footer">
                  <span>
                    <span className="green-dot" />
                    {shortDate(data.generatedAt)} 集計 · JST
                  </span>
                  <button className="text-button" onClick={() => setDefinitions(true)}>
                    <CircleHelp size={14} />
                    指標の定義を確認
                  </button>
                </div>
              </>
            )
          )}
        </main>
        <footer className="app-footer">
          ISC FES ANALYTICS<span>次の「楽しかった」につなげるデータ。</span>
        </footer>
      </div>
      {definitions && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDefinitions(false);
          }}
        >
          <dialog
            ref={dialogRef}
            onCancel={() => setDefinitions(false)}
            aria-labelledby="definition-title"
            className="definitions"
          >
            <div className="panel-heading">
              <h2 id="definition-title">指標の定義と読み方</h2>
              <button
                className="icon-button"
                onClick={() => setDefinitions(false)}
                aria-label="閉じる"
              >
                <X size={20} />
              </button>
            </div>
            <dl>
              <dt>期間と注文の状態</dt>
              <dd>
                開始以上・終了未満の注文作成日時で抽出します。状態は集計時点の値です。期間内の注文が後日完了・キャンセルすると、過去の指標も変わります。時系列の売上・所要時間も注文作成時刻に帰属します。
              </dd>
              <dt>売上・販売点数</dt>
              <dd>
                既定は受取完了分のみ。詳細条件でキャンセル以外・全注文にも変更できます。売上は保存済みの注文金額、メニュー別は注文時の単価とトッピング代×数量です。入金額や返金を管理する指標ではありません。メニュー指定時の注文数はそのメニューを含む注文数、売上はその明細だけです。
              </dd>
              <dt>キャンセル率・対面受付率</dt>
              <dd>
                抽出後の注文数を分母とします。状態や受付方法を絞ると分母も変わります。¹ 対面受付は
                limit_exempted_by_account_id
                がある注文から推定します。スタッフ・管理者による代理注文が対象で、対面取引を直接記録した値ではありません。
              </dd>
              <dt>完了までの時間</dt>
              <dd>
                完了時間＝作成→受取完了、調理時間＝作成→調理完了、受取待ち＝調理完了→受取完了。各時刻に到達した注文のみ集計し、未完了分を0分にはしません。P90は90%の注文がその時間以内に完了したことを示します。
              </dd>
              <dt>混雑度の推定</dt>
              <dd>
                各区間の終了直前（進行中の区間は集計時点まで）に、未調理・未完了注文数、または区間内の新規注文数から3段階に分類します。期間開始前から残っている注文も含みます。入力値はその時点以前の最新履歴を引き継ぎ、履歴導入前は欠測とします。同時刻に異なる入力値がある場合も欠測です。メニュー・状態・受付方法の絞り込みは混雑度には適用しません。
              </dd>
              <dt>取り扱い</dt>
              <dd>
                DB
                は読み取り専用トランザクションの同一スナップショットから取得。個人のID・メール・コメントは表示・出力しません。CSV
                は現在の画面の切り口を出力します。複数日を選ぶと時間帯別・曜日別は合算になります。
              </dd>
            </dl>
            <button className="button button-green" onClick={() => setDefinitions(false)}>
              閉じる
            </button>
          </dialog>
        </div>
      )}
    </div>
  );
}
