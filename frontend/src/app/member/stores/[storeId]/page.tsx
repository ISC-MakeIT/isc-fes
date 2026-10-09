import { StoreHomeView } from "@/_pages/store-home";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "店舗ホーム",
};

export default async function StoreHomePage({
  params,
}: PageProps<"/member/stores/[storeId]">) {
  const { storeId } = await params;
  return <StoreHomeView storeId={storeId} />;
}
