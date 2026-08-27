import { createApiClient } from "@/shared/api";
import {
  currentAccountKey,
  getStatusMessage,
  SESSION_COOKIE_NAME,
  STATUS,
} from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { Account } from "../model/types";
import { queryOptions } from "@tanstack/react-query";

type FetchCurrentAccountResult = Promise<Account | null>;

/**
 * 現在のアカウント情報を取得するAPI
 * 未ログインであればnullを返す
 * @returns
 */
export async function fetchCurrentAccount(): FetchCurrentAccountResult {
  // Session Cookieがそもそもなければ、APIを叩く前に未ログインと判定する
  const isServer = typeof window === "undefined";
  if (isServer) {
    const { cookies } = await import("next/headers");
    const session = (await cookies()).get(SESSION_COOKIE_NAME);
    if (!session) return null;
  }

  const client = await createApiClient();
  const { data, error, response } = await client.GET("/me");

  if (error) {
    if (response.status === STATUS.UNAUTHORIZED.code) return null;
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Account, data);
}

export function currentAccountQueryOptions() {
  return queryOptions({
    queryKey: currentAccountKey(),
    queryFn: fetchCurrentAccount,
    staleTime: Infinity,
  });
}
