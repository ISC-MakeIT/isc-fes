import { createApiClient } from "@/shared/api";
import { getStatusMessage, storeApplicationsKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";
import { StoreApplication } from "../model/types";

export function storeApplicationQueryOptions() {
  return queryOptions({
    queryKey: storeApplicationsKey(),
    queryFn: fetchStoreApplications,
  });
}

async function fetchStoreApplications() {
  const client = await createApiClient();
  const { data, error, response } = await client.GET("/store-applications");

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(v.array(StoreApplication), data.data);
}
