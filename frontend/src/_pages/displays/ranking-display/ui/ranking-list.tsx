"use client";

import { storeRankingQueryOptions } from "@/entities/store";
import { useQuery } from "@tanstack/react-query";
import { RankingRow } from "./ranking-row";

export function RankingList() {
  const { data, isPending, isError } = useQuery(storeRankingQueryOptions());

  if (!data) {
    return (
      <p role="status" className="text-foreground py-12 text-2xl">
        {isPending
          ? "ランキングを読み込んでいます…"
          : "ランキングを取得できませんでした。自動で再取得します。"}
      </p>
    );
  }

  if (data.length === 0) {
    return (
      <p role="status" className="py-12 text-2xl">
        ランキングの対象店舗はまだありません
      </p>
    );
  }

  return (
    <>
      <ol aria-label="売り上げ上位の店舗" className="flex flex-col gap-6">
        {data.map((store) => (
          <RankingRow key={store.id} store={store} />
        ))}
      </ol>
      {isError && (
        <p role="status" className="mt-3 text-base">
          更新できなかったため、前回のランキングを表示しています。
        </p>
      )}
    </>
  );
}
