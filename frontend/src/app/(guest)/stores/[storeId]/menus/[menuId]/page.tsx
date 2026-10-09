import { GuestMenuDetailView } from "@/_pages/guest-menu-detail";
import { storeMenusQueryOptions } from "@/entities/menu";
import { createQueryClient } from "@/shared/api";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/stores/[storeId]/menus/[menuId]">): Promise<Metadata> {
  const { menuId, storeId } = await params;
  const queryClient = createQueryClient();
  const menus = await queryClient.fetchQuery(storeMenusQueryOptions(storeId));
  const menu = menus.find((menu) => menu.id === menuId);

  if (!menu) {
    notFound();
  }

  return { title: menu.name };
}

export default async function GuestMenuDetailPage({
  params,
}: PageProps<"/stores/[storeId]/menus/[menuId]">) {
  const { menuId, storeId } = await params;

  return <GuestMenuDetailView storeId={storeId} menuId={menuId} />;
}
