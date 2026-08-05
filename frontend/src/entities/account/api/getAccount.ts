import "server-only";
import { client } from "@/shared/api/client";
import { cookies } from "next/headers";
import { Account } from "../model/types";
import { v } from "@/shared/lib/valibot";

const SESSION_COOKIE_NAME = "isc_fes_account_session";

export async function getAccount(): Promise<Account | null> {
  const session = (await cookies()).get(SESSION_COOKIE_NAME);
  if (!session) return null;

  const { data, error } = await client.GET("/me", {
    headers: {
      Cookie: session.toString(),
    },
  });
  if (!data) return null;

  if (error) throw new Error(`アカウントが取得できませんでした: ${error}`);

  const parsedAccount = v.parse(Account, data);

  return parsedAccount;
}
