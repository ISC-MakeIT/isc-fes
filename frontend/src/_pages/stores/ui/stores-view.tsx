import { Plus as PlusIcon } from "lucide-react";
import { HeadingCard } from "@/shared/ui/heading-card";
import { LinkButton } from "@/shared/ui/link-button";
import { StoreList } from "./store-list";
import { registerStoreUrl } from "@/shared/config";

export function StoresView() {
  return (
    <div className="mx-auto flex max-w-141.5 flex-col items-center justify-center space-y-9 px-6 py-18">
      <HeadingCard className="rounded-md px-8 py-4 text-xl">
        店舗一覧
      </HeadingCard>
      <p>
        店舗を選んでください。
        <br />
        店舗がない場合は、店舗登録したメンバーに
        <span className="text-notice">招待リンク</span>
        をもらうか、<span className="text-notice">新規店舗申請</span>
        をして新しく店舗を登録してください。
      </p>
      <StoreList />

      <LinkButton href={registerStoreUrl()} className="px-14 py-4 text-xl">
        <PlusIcon className="size-6" />
        新規店舗申請
      </LinkButton>
    </div>
  );
}
