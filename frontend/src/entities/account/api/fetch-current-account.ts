import { createApiClient } from "@/shared/api";
import { currentAccountKey, getStatusMessage } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { Account } from "../model/types";
import { queryOptions } from "@tanstack/react-query";

async function fetchCurrentAccount() {
  const client = await createApiClient();
  const { data, error, response } = await client.GET("/me");

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Account, data);
}

export function currentAccountQueryOptions() {
  return queryOptions({
    queryKey: currentAccountKey(),
    queryFn: fetchCurrentAccount,
    staleTime: Infinity,
  });
}
