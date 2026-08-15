import { REGISTER_STORE_URL } from "@/shared/config";
import { HeadingCard } from "@/shared/ui/heading-card";
import { LinkButton } from "@/shared/ui/link-button";
import { StoreCardSkelton, StoreList } from "./store-list";
import { Suspense } from "react";

export function StoresView() {
  return (
    <div className="mx-auto my-8 grid w-4/5 place-content-center space-y-8 sm:max-w-lg">
      <HeadingCard>店舗一覧</HeadingCard>
      <p>
        店舗を選んでください。
        <br />
        店舗がない場合は、店舗登録したメンバーに
        <span className="text-red-500">招待リンク</span>
        をもらうか、<span className="text-red-500">新規店舗申請</span>
        をして新しく店舗を登録してください。
      </p>
      <Suspense fallback={<StoreCardSkelton />}>
        <StoreList />
      </Suspense>

      <LinkButton className="mx-auto" href={REGISTER_STORE_URL}>
        +新規店舗申請
      </LinkButton>
    </div>
  );
}
