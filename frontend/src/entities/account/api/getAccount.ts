import "server-only";
import { client } from "@/shared/api/client";
import { cookies } from "next/headers";
import { Account } from "../model/types";
import { v } from "@/shared/lib/valibot";
import { SESSION_COOKIE_NAME } from "@/shared/config/cookies";

export async function getAccount(): Promise<Account | null> {
  const session = (await cookies()).get(SESSION_COOKIE_NAME);
  if (!session) return null;

  const { data, error, response } = await client.GET("/me", {
    headers: {
      Cookie: `${session.name}=${session.value}`,
    },
  });
  if (error) {
    // 未ログイン or セッションが無効の場合
    if (response.status === 401) return null;

    throw new Error(`アカウントが取得できませんでした: ${error.message}`);
  }

  // data / errorは排他的なunion型なので、ここに到達した地点でdataがあることは保証されてる
  const parsedAccount = v.parse(Account, data);

  return parsedAccount;
}
