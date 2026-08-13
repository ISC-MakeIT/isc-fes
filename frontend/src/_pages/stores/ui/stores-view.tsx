import { REGISTER_STORE_URL } from "@/shared/config";
import { HeadingCard } from "@/shared/ui/heading-card";
import { LinkButton } from "@/shared/ui/link-button";
import { StoreList } from "./store-list";

export async function StoresView() {
  return (
    <>
      <HeadingCard>店舗一覧</HeadingCard>
      <p>
        店舗を選んでください。
        <br />
        店舗がない場合は、店舗登録したメンバーに
        <span className="text-red-500">招待リンク</span>
        をもらうか、<span className="text-red-500">新規店舗申請</span>
        をして新しく店舗を登録してください。
      </p>
      <StoreList />

      <LinkButton href={REGISTER_STORE_URL}>新規作成</LinkButton>
    </>
  );
}
