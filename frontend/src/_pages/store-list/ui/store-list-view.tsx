import { REGISTER_STORE_URL } from "@/shared/config";
import { LinkButton } from "@/shared/ui/link-button";

export function StoreListView() {
  return (
    <>
      <LinkButton href={REGISTER_STORE_URL}>新規作成</LinkButton>
    </>
  );
}
