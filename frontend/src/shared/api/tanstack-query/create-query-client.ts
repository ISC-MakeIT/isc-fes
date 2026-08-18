import { QueryClient } from "@tanstack/react-query";
import { getServerQueryClient } from "./server-client";

// server側でprefetchするようにサーバー側のclientも用意している
export function createQueryClient(): QueryClient {
  const isServer = typeof window === "undefined";
  return isServer ? getServerQueryClient() : createClient();
}

export function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000 },
    },
  });
}
