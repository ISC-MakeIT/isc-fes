import { Store } from "@/entities/store";
import { createApiClient } from "@/shared/api";
import { v } from "@/shared/lib/valibot";

export async function fetchVisibleStores(): Promise<Store[]> {
  const client = await createApiClient();
  const { data, error } = await client.GET("/stores");

  if (error) throw new Error(`データの取得に失敗しました`);

  const parsed = v.parse(v.array(Store), data.data);

  return parsed;
}
