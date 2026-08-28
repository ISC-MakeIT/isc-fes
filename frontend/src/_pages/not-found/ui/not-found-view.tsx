import { homeUrl } from "@/shared/config";
import { LinkButton } from "@/shared/ui/link-button";
import { ChevronLeft } from "lucide-react";

export function NotFoundView() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-3 text-center">
      <h1 className="text-primary text-shadow-secondary text-8xl font-bold text-shadow-[4px_4px_0] md:text-9xl">
        404
      </h1>
      <h2 className="text-xl font-bold md:text-4xl">
        お探しのページは見つかりませんでした。
      </h2>
      <p className="text-base font-medium md:text-xl">
        アクセスされたページは削除されたか
        <br />
        公開期限が過ぎた可能性があります。
        <br />
        お手数ですが、トップページより再度お探しください。
      </p>
      {/* TODO: 前のページがstores/だったかどうかで遷移先を分岐させる? */}
      <LinkButton className="text-lg font-bold md:text-2xl" href={homeUrl()}>
        <ChevronLeft className="size-7" />
        トップに戻る
      </LinkButton>
    </div>
  );
}
