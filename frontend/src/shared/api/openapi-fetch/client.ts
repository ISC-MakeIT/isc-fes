import createOpenApiClient from "openapi-fetch";
import type { paths } from "../schema";
import { API_BASE_URL } from "../../config/env";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/shared/config/cookies";

const baseUrl = API_BASE_URL;

export function createApiClient() {
  const isServer = typeof window === "undefined";
  return isServer ? createServerClient() : createClient();
}

/**
 * ブラウザから使用する用のOpenAPI Fetchクライアント
 * @returns
 */
function createClient() {
  return createOpenApiClient<paths>({
    baseUrl,
    credentials: "include",
  });
}

/**
 * サーバーから使用する用のOpenAPI Fetchクライアント
 * @param cookieHeader セットするcookie
 * @returns
 */
async function createServerClient() {
  const session = (await cookies()).get(SESSION_COOKIE_NAME);
  return createOpenApiClient<paths>({
    baseUrl,
    credentials: "include",
    headers: session
      ? { Cookie: `${session.name}=${session.value}` }
      : undefined,
  });
}
