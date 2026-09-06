import { createApiClient, uploadImage } from "@/shared/api";
import type { components } from "@/shared/api/";
import { CreateStoreForm } from "../model/types";
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
  const { image, ...storeApplication } = formValues;
  if (image === undefined) {
    return { error: getStatusMessage(400) };
  }

  const uploadResult = await uploadImage(image);
  if (uploadResult.data === undefined) {
    return { error: uploadResult.error };
  }

  const client = await createApiClient();
  const { data, error, response } = await client.POST("/store-applications", {
    body: {
      ...storeApplication,
      imageObjectKey: uploadResult.data.imageObjectKey,
    },
  });

  if (error) {
    const errorMessage = getStatusMessage(response.status);
    return { error: errorMessage };
  }

  return { data };
}
