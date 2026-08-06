import "server-only";
import { cookies } from "next/headers";
import { Account } from "../model/types";
import { v } from "@/shared/lib/valibot";
import { SESSION_COOKIE_NAME } from "@/shared/config/cookies";
import { createApiClient } from "@/shared/api/openapi-fetch/client";

export async function getAccount(): Promise<Account | null> {
  const session = (await cookies()).get(SESSION_COOKIE_NAME);
  if (!session) return null;

  const client = await createApiClient();
  const { data, error, response } = await client.GET("/me");
  if (error) {
    // 未ログイン or セッションが無効の場合
    if (response.status === 401) return null;

    throw new Error(`アカウントが取得できませんでした: ${error.message}`);
  }

  // data / errorは排他的なunion型なので、ここに到達した地点でdataがあることは保証されてる
  const parsedAccount = v.parse(Account, data);

  return parsedAccount;
}
