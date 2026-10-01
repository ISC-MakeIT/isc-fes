import createOpenApiClient from "openapi-fetch";
import type { Middleware } from "openapi-fetch";
import * as Sentry from "@sentry/nextjs";
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
  const client = createOpenApiClient<paths>({
    baseUrl: getApiBaseUrl(),
    credentials: "include",
  });
  client.use(apiErrorReportingMiddleware);
  return client;
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

  const client = createOpenApiClient<paths>({
    baseUrl: getApiBaseUrl(),
    credentials: "include",
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });
  client.use(apiErrorReportingMiddleware);
  return client;
}

const apiErrorReportingMiddleware: Middleware = {
  onResponse({ request, response, schemaPath }) {
    if (response.status < 500) return;

    Sentry.withScope((scope) => {
      scope.setTag("api.method", request.method);
      scope.setTag("api.route", schemaPath);
      scope.setTag("http.status_code", response.status);
      scope.setFingerprint([
        "api-response",
        request.method,
        schemaPath,
        String(response.status),
      ]);
      Sentry.captureException(
        new Error(
          `API ${request.method} ${schemaPath} responded with ${response.status}`,
        ),
      );
    });
  },
  onError({ error, request, schemaPath }) {
    Sentry.withScope((scope) => {
      scope.setTag("api.method", request.method);
      scope.setTag("api.route", schemaPath);
      scope.setFingerprint(["api-network", request.method, schemaPath]);
      Sentry.captureException(
        error instanceof Error
          ? error
          : new Error(`API ${request.method} ${schemaPath} request failed`),
      );
    });
  },
};
