import { createApiClient } from "@/shared/api";
import { Topping } from "../model/types";
import { getStatusMessage, menuToppingsKey } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { queryOptions } from "@tanstack/react-query";

type FetchMenuToppingsParams = {
  storeId: string;
  menuId: string;
};

export async function fetchMenuToppings({
  storeId,
  menuId,
}: FetchMenuToppingsParams): Promise<Topping[]> {
  const client = await createApiClient();
  const { data, error, response } = await client.GET(
    "/stores/{store_id}/menus/{menu_id}/toppings",
    {
      params: {
        path: {
          store_id: storeId,
          menu_id: menuId,
        },
      },
    },
  );

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(v.array(Topping), data.data);
}

export function menuToppingsQueryOptions({
  menuId,
  storeId,
}: FetchMenuToppingsParams) {
  return queryOptions({
    queryKey: menuToppingsKey(storeId, menuId),
    queryFn: () => fetchMenuToppings({ storeId, menuId }),
  });
}
