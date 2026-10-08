import { GuestStoreDetailView } from "@/_pages/guest-store-detail";
import { storeDetailQueryOptions } from "@/entities/store";
import { createQueryClient } from "@/shared/api";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/stores/[storeId]">): Promise<Metadata> {
  const { storeId } = await params;
  const queryClient = createQueryClient();
  const store = await queryClient.fetchQuery(storeDetailQueryOptions(storeId));

  return { title: store.name };
}

export default async function GuestStoreDetailPage({
  params,
}: PageProps<"/stores/[storeId]">) {
  const { storeId } = await params;
  return <GuestStoreDetailView storeId={storeId} />;
}
