"use client";

import { ErrorView } from "@/_pages/error";
import { useRouter } from "next/navigation";
import { startTransition } from "react";

type ErrorProps = {
  reset: () => void;
};

export default function Error({ reset }: ErrorProps) {
  const router = useRouter();

  function handleRetry() {
    // startTransitionはコールバック内の処理の中でもレンダーに関する部分の処理の優先度を下げてくれる関数
    // reset()がrouter.refresh()の処理を待たずにUIを描画しようとするのを防ぐために使用している
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <html lang="ja">
      <body className="min-h-screen">
        <ErrorView retryFunction={handleRetry} />
      </body>
    </html>
  );
}
