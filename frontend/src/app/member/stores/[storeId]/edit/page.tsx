import { StoreEditView } from "@/_pages/store-edit";
import { currentAccountQueryOptions } from "@/entities/account";
import {
  storeMemberByAccountIdQueryOptions,
  StoreMemberRole,
} from "@/entities/store-member";
import { createQueryClient } from "@/shared/api";
import { loginUrl, storeListUrl } from "@/shared/config";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "店舗情報",
};

export default async function StoreEditPage({
  params,
}: PageProps<"/member/stores/[storeId]/edit">) {
  const { storeId } = await params;
  const queryClient = createQueryClient();
  const account = await queryClient.fetchQuery(currentAccountQueryOptions());
  if (!account) {
    redirect(loginUrl(storeListUrl()));
  }

  const member = await queryClient.fetchQuery(
    storeMemberByAccountIdQueryOptions(storeId, account.id),
  );
  if (member?.role !== StoreMemberRole.Manager) {
    notFound();
  }

  return <StoreEditView storeId={storeId} />;
}
