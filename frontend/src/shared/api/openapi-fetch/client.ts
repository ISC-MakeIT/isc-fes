import createOpenApiClient from "openapi-fetch";
import type { paths } from "../schema";
import {
  getApiBaseUrl,
  ACCOUNT_SESSION_COOKIE_NAME,
  GUEST_SESSION_COOKIE_NAME,
} from "@/shared/config";

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
    baseUrl: getApiBaseUrl(),
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
  const cookieStore = await cookies();
  const sessionCookies = [
    cookieStore.get(ACCOUNT_SESSION_COOKIE_NAME),
    cookieStore.get(GUEST_SESSION_COOKIE_NAME),
  ].filter((cookie) => cookie !== undefined);

  const cookieHeader = sessionCookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  return createOpenApiClient<paths>({
    baseUrl: getApiBaseUrl(),
    credentials: "include",
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });
}
