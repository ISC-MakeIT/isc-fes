import { Topping, ToppingName, ToppingUnitPrice } from "@/entities/topping";
import { createApiClient } from "@/shared/api";
import { getStatusMessage } from "@/shared/config";
import { v } from "@/shared/lib/valibot";

export const EditToppingInput = v.object({
  name: ToppingName,
  unitPrice: ToppingUnitPrice,
});
export type EditToppingInput = v.InferOutput<typeof EditToppingInput>;

type EditToppingParams = {
  storeId: string;
  toppingId: string;
  editToppingInput: EditToppingInput;
};

export async function editTopping({
  editToppingInput,
  storeId,
  toppingId,
}: EditToppingParams) {
  const apiClient = await createApiClient();
  const { data, error, response } = await apiClient.PATCH(
    "/stores/{store_id}/toppings/{topping_id}",
    {
      params: {
        path: {
          store_id: storeId,
          topping_id: toppingId,
        },
      },
      body: editToppingInput,
    },
  );

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Topping, data);
}
