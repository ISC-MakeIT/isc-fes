import { currentAccountQueryOptions } from "@/entities/account";
import { createQueryClient } from "@/shared/api";
import { loginUrl } from "@/shared/config";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";

/**
 * ログイン必須のページにアクセスしてきた人を弾く用のLayout
 */
export default async function MemberLayout(props: LayoutProps<"/">) {
  const queryClient = createQueryClient();
  const data = await queryClient.fetchQuery(currentAccountQueryOptions());
  if (!data) redirect(loginUrl());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
