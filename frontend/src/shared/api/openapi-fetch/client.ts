import createOpenApiClient from "openapi-fetch";
import type { paths } from "../schema";
import { ACCOUNT_SESSION_COOKIE_NAME } from "@/shared/config";
import { API_BASE_URL } from "@/shared/config";

export async function createApiClient() {
  const isServer = typeof window === "undefined";
  return isServer ? createServerClient() : createClient();
}

/**
 * ブラウザから使用する用のOpenAPI Fetchクライアント
 * @returns
 */
function createClient() {
  return createOpenApiClient<paths>({
    baseUrl: API_BASE_URL,
    credentials: "include",
  });
}

/**
 * サーバーから使用する用のOpenAPI Fetchクライアント
 * @param cookieHeader セットするcookie
 * @returns
 */
async function createServerClient() {
  // createApiClient()でブラウザ、サーバーどちらからも呼べるようにしてるので、
  // server用のimportはdynamicにしないとクライアントで実行時エラーが起きる
  const { cookies } = await import("next/headers");
  const session = (await cookies()).get(ACCOUNT_SESSION_COOKIE_NAME);

  return createOpenApiClient<paths>({
    baseUrl: API_BASE_URL,
    credentials: "include",
    headers: session
      ? { Cookie: `${session.name}=${session.value}` }
      : undefined,
  });
}
