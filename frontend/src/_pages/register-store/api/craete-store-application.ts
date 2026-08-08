import { createApiClient } from "@/shared/api";
import { components } from "@/shared/api/";
import { operations } from "@/shared/api/schema";
import { CreateStoreForm } from "../model/types";

type CreateStoreApplicationResponse =
  components["schemas"]["CreateStoreApplicationResponse"];

type CreateStoreApplicationRequest =
  operations["createStoreApplication"]["requestBody"]["content"]["multipart/form-data"];

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

      fd.append("name", body.name);
      fd.append("room", body.room);
      fd.append("description", body.description);
      fd.append("image", body.image);
      console.log(formData);
      return fd;
    },
  });

  if (error) {
    if (response.status >= 500) {
      throw new Error(`店舗を作成できませんでした：${error.message}`);
    }
    return { error: error.message, response };
  }

  return { data };
}
