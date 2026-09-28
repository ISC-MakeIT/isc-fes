import { QueryClient } from "@tanstack/react-query";
import { getServerQueryClient } from "./server-client";

let browserQueryClient: QueryClient | undefined;

// server側でprefetchするようにサーバー側のclientも用意している
export function createQueryClient(): QueryClient {
  const isServer = typeof window === "undefined";
  if (isServer) {
    return getServerQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = createClient();
  }

  return browserQueryClient;
}

export function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000 },
    },
  });
}
