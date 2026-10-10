import { StoreKitchenView } from "@/_pages/store-kitchen";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "キッチン",
};

export default async function KitchenPage({
  params,
}: PageProps<"/member/stores/[storeId]/kitchen">) {
  const { storeId } = await params;
  return <StoreKitchenView storeId={storeId} />;
}
