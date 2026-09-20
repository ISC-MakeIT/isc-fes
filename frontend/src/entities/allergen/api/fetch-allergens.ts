import { createApiClient } from "@/shared/api";
import { getStatusMessage } from "@/shared/config";
import { v } from "@/shared/lib/valibot";
import { Allergen } from "../model/types";

export async function fetchAllergens() {
  const client = await createApiClient();
  const { data, error, response } = await client.GET("/allergens");

  if (error) {
    return getStatusMessage(response.status);
  }

  return v.parse(Allergen, data.data);
}
