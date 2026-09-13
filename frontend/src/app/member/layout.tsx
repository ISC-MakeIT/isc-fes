import { currentAccountQueryOptions } from "@/entities/account";
import { createQueryClient } from "@/shared/api";
import { loginUrl, storeListUrl } from "@/shared/config";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";

/**
 * ログイン必須のページにアクセスしてきた人を弾く用のLayout
 */
export default async function MemberLayout(props: LayoutProps<"/">) {
  const queryClient = createQueryClient();
  const account = await queryClient.fetchQuery(currentAccountQueryOptions());

  if (!account) {
    // TODO: 直前にいたページへ戻したい
    //       layoutで今のURLを取得するスマートなやり方がなさそうなので、proxy.tsに移すかもしれない
    const redirectTo = storeListUrl();
    redirect(loginUrl(redirectTo));
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
