import { ChevronLeft } from "lucide-react";
import { SubmitButton } from "./submit-button";

export function NotFoundView() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 text-center">
      <h1 className="text-primary text-shadow-secondary text-9xl font-bold text-shadow-[4px_4px_0]">
        404
      </h1>
      <h2 className="text-4xl font-bold">
        お探しのページは見つかりませんでした。
      </h2>
      <p className="text-xl font-medium">
        アクセスされたページは削除されたか
        <br />
        公開期限が過ぎた可能性があります。
        <br />
        お手数ですが、トップページより再度お探しください。
      </p>
      <SubmitButton className="text-2xl font-bold" isDot={false}>
        <ChevronLeft className="size-7" />
        トップに戻る
      </SubmitButton>
    </div>
  );
}
