import { createApiClient } from "@/shared/api";
import { components } from "@/shared/api/";
import { CreateStoreForm } from "../model/types";
import { buildFormDataBody } from "@/shared/lib/build-form-data-body";
import { getStatusMessage } from "@/shared/config";

type CreateStoreApplicationResponse =
  components["schemas"]["CreateStoreApplicationResponse"];

export type CreateStoreApplicationResult =
  | { data: CreateStoreApplicationResponse; error?: never }
  | { data?: never; error: string };

/**
 * 店舗を新規作成するAPI
 * @param formData フォームの入力値
 * @returns data
 */
export async function createStoreApplication(
  formValues: CreateStoreForm,
): Promise<CreateStoreApplicationResult> {
  const client = await createApiClient();
  const { data, error, response } = await client.POST("/store-applications", {
    // openapi-fetchの型定義がmultipart/form-dataに対応していないための回避
    body: formValues as never,
    bodySerializer: (body) => buildFormDataBody(body),
  });

  if (error) {
    const errorMessage = getStatusMessage(response.status);
    return { error: errorMessage };
  }

  return { data };
}
