import { createApiClient } from "@/shared/api";
import { components } from "@/shared/api/";
import { CreateStoreForm } from "../model/types";

type CreateStoreApplicationResponse =
  components["schemas"]["CreateStoreApplicationResponse"];

export type CreateStoreApplicationresult =
  | { data: CreateStoreApplicationResponse; error?: never; response?: never }
  | { data?: never; error: string; response: Response };

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
    body: formData as never,
    bodySerializer(body) {
      const fd = new FormData();

      for (const [key, value] of Object.entries(body)) {
        if (value === "undefined") continue;
        fd.append(key, value);
      }
      return fd;
    },
  });

  if (error) {
    return { error: error.message, response };
  }

  return { data };
}
