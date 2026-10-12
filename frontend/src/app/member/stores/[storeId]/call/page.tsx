import { StoreOrderCallView } from "@/_pages/store-order-call";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "呼び出し",
};

export default async function CallPage({
  params,
}: PageProps<"/member/stores/[storeId]/call">) {
  const { storeId } = await params;
  return <StoreOrderCallView storeId={storeId} />;
}
