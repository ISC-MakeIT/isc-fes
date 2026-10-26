import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  FlaskConical,
  MessageSquare,
  Radio,
  Store,
  Users,
} from "lucide-react";
import { ReportFrame } from "./shared";

const reports = [
  {
    path: "/stores",
    title: "店舗分析",
    icon: Store,
    kicker: "STORE PERFORMANCE",
    description: "店舗やメニューを比べて、売上と運営の違いを見つける。",
    tags: ["売上・販売数", "調理・受取時間", "平均・中央値"],
    tone: "green",
  },
  {
    path: "/guests",
    title: "ゲスト分析",
    icon: Users,
    kicker: "GUEST EXPERIENCE",
    description: "登録から購入、滞在の手がかりまで。来場者の体験を振り返る。",
    tags: ["累計ゲスト数", "ゲスト単価", "観測した滞在時間"],
    tone: "gold",
  },
  {
    path: "/reviews",
    title: "レビュー分析",
    icon: MessageSquare,
    kicker: "REVIEW INSIGHTS",
    description: "ゲストと店舗スタッフの評価・コメントから、次の改善を考える。",
    tags: ["ratingの構成比", "店舗側・ゲスト側", "コメント"],
    tone: "blue",
  },
];
export default function HomeReport({ query }: { query: string }) {
  const advanced = (view: string) => `/advanced${query ? `${query}&` : "?"}view=${view}`;
  const params = new URLSearchParams(query);
  const start = params.get("start"),
    end = params.get("end");
  const period = start && end ? { start, end, interval: params.get("interval") ?? "30m" } : null;
  return (
    <ReportFrame page="home" filters={period} metadata={null} loading={false} error={null}>
      <section aria-label="分析ページを選ぶ" className="home-report-grid">
        <Link href={`/overview${query}`} className="home-feature" aria-label="全体分析を開く">
          <div className="home-feature-copy">
            <span className="home-kicker">START HERE / FESTIVAL OVERVIEW</span>
            <h2>
              <BarChart3 size={23} />
              まずは、学園祭全体を見渡す。
            </h2>
            <p>売上・注文数・キャンセル率・対面受付率を、全店舗の累計で。</p>
            <span className="home-open">
              全体分析を開く
              <ArrowRight size={16} />
            </span>
          </div>
          <div className="home-feature-visual" aria-hidden="true">
            <div>
              <span>累計の推移</span>
              <span>2026</span>
            </div>
            <svg viewBox="0 0 290 85" fill="none">
              <path
                d="M0 70H290M0 40H290M0 10H290"
                stroke="currentColor"
                opacity=".12"
                strokeDasharray="3 5"
              />
              <path
                d="M2 75H30L47 69H74L95 51H126L150 43H183L202 20H233L257 8H288"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx="288" cy="8" r="4" fill="currentColor" />
            </svg>
            <small>売上・注文・受付をひとつの時間軸で</small>
          </div>
        </Link>
        {reports.map((r) => (
          <Link
            className={`home-report-card home-tone-${r.tone}`}
            href={`${r.path}${query}`}
            key={r.path}
            aria-label={`${r.title}を開く`}
          >
            <div className="home-card-top">
              <span className="home-card-icon">
                <r.icon size={22} />
              </span>
              <ArrowUpRight size={18} />
            </div>
            <span className="home-kicker">{r.kicker}</span>
            <h2>{r.title}</h2>
            <p>{r.description}</p>
            <div className="home-tags">
              {r.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </Link>
        ))}
      </section>
      <section className="home-tools" aria-labelledby="tools-title">
        <div className="report-section-heading">
          <div>
            <span className="section-number">TOOLS</span>
            <h2 id="tools-title">仮説を、もう一歩確かめる</h2>
          </div>
          <span>条件を調整して詳しく分析</span>
        </div>
        <div className="home-tool-grid">
          <Link href={advanced("congestion")} className="home-tool" aria-label="混雑度の検証を開く">
            <Radio size={22} />
            <div>
              <h3>混雑度の検証</h3>
              <p>入力された混雑度と、注文数からの推定を比較。</p>
            </div>
            <ArrowRight size={17} />
          </Link>
          <Link
            href={advanced("explorer")}
            className="home-tool"
            aria-label="エクスプローラーを開く"
          >
            <FlaskConical size={22} />
            <div>
              <h3>エクスプローラー</h3>
              <p>指標・切り口・グラフを自由に組み合わせる。</p>
            </div>
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      <p className="home-footnote">
        各分析ページで期間・集計間隔を選べます。グラフと表はCSVで出力して、Notionでの振り返りにも使えます。
      </p>
    </ReportFrame>
  );
}
