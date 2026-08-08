import { REGISTER_STORE_URL } from "@/shared/config";
import { buttonVariants } from "@/shared/ui/button";
import Link from "next/link";

export function StoreListView() {
  return (
    <>
      <Link href={REGISTER_STORE_URL} className={buttonVariants()}>
        新規店舗登録
      </Link>
    </>
  );
}
