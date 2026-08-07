import { createApiClient } from "@/shared/api";
import { CreateStoreForm } from "../model/types";
import { components } from "@/shared/api/schema";

type CreateStoreApplicationResponse =
  components["schemas"]["CreateStoreApplicationResponse"];

export type CreateStoreApplicationresult =
  | { data: CreateStoreApplicationResponse; error?: never }
  | { data?: never; errorMessgae: string };

/**
 * 店舗を新規作成するAPI
 * @param formData フォームの入力値
 * @returns data
 */
export async function createStoreApplication(
  formData: CreateStoreForm,
): Promise<CreateStoreApplicationresult> {
  const client = await createApiClient();
  const { data, error, response } = await client.POST("/store-applications", {
    body: { ...formData },
  });

  if (error) {
    if (response.status >= 500) {
      throw new Error(`店舗を作成できませんでした：${error.message}`);
    }
    return { errorMessgae: error.message };
  }

  return { data };
}
