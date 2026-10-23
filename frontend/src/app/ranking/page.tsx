import { RankingDisplayView } from "@/_pages/displays/ranking-display";
import { FESTIVAL_TIME_ZONE } from "@/shared/config";
import type { Metadata } from "next";
import { Temporal } from "temporal-polyfill-lite";

export const metadata: Metadata = {
  title: "売り上げランキング！！（直近1時間）",
  robots: { index: false, follow: false },
};

// 長時間表示する案内画面の初期時刻をリクエストごとに取得する。
export const dynamic = "force-dynamic";

export default function RankingPage() {
  const initialDateTime =
    Temporal.Now.plainDateTimeISO(FESTIVAL_TIME_ZONE).toString();

  return <RankingDisplayView initialDateTime={initialDateTime} />;
}
