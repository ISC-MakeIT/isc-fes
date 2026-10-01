"use client";

import { ErrorView } from "@/_pages/error";
import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import "./globals.css";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  const router = useRouter();
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  function handleRetry() {
    // startTransitionはコールバック内の処理の中でもレンダーに関する部分の処理の優先度を下げてくれる関数
    // reset()がrouter.refresh()の処理を待たずにUIを描画しようとするのを防ぐために使用している
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-screen">
        <ErrorView retryFunction={handleRetry} />
      </body>
    </html>
  );
}
