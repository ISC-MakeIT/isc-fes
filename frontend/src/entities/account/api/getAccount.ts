import "server-only";
import { client } from "@/shared/api/client";
import { cookies } from "next/headers";
import { Account } from "../model/types";
import { v } from "@/shared/lib/valibot";
import { SESSION_COOKIE_NAME } from "@/shared/config/cookies";

export async function getAccount(): Promise<Account | null> {
  const session = (await cookies()).get(SESSION_COOKIE_NAME);
  if (!session) return null;

  const { data, error } = await client.GET("/me", {
    headers: {
      Cookie: `${session.name}=${session.value}`,
    },
  });
  if (error) throw new Error(`アカウントが取得できませんでした: ${error}`);
  if (!data) return null;

  const parsedAccount = v.parse(Account, data);

  return parsedAccount;
}
