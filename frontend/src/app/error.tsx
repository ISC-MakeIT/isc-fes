"use client";

import { SubmitButton } from "@/shared/ui/submit-button";
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-10">
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-primary text-shadow-secondary text-9xl font-bold text-shadow-[4px_4px_0]">
          Error
        </h1>

        <p className="text-xl">
          予期せぬエラーが発生しました。
          <br />
          時間をおいて再度お試しください。
        </p>
      </div>

      <SubmitButton
        isDot={false}
        className="px-10 py-4 text-2xl font-bold"
        onClick={handleRetry}
      >
        リトライ
      </SubmitButton>
    </div>
  );
}
