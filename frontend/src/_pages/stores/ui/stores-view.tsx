import { Plus as PlusIcon } from "lucide-react";
import { HeadingCard } from "@/shared/ui/heading-card";
import { LinkButton } from "@/shared/ui/link-button";
import { StoreCardSkelton, StoreList } from "./store-list";
import { Suspense } from "react";
import { CenterLayout } from "@/shared/ui/center-layout";
import { registerStoreUrl } from "@/shared/config";

export function StoresView() {
  return (
    <CenterLayout>
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

      <LinkButton href={registerStoreUrl()}>
        <PlusIcon />
        新規店舗申請
      </LinkButton>
    </CenterLayout>
  );
}
