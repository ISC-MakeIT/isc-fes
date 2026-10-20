import { PickupDisplayView } from "@/_pages/pickup-display";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "受け渡し",
};

export default async function PickupPage({
  params,
}: PageProps<"/member/stores/[storeId]/pickup">) {
  const { storeId } = await params;

  return <PickupDisplayView storeId={storeId} />;
}
