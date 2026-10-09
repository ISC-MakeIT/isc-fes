import { createApiClient, uploadImage } from "@/shared/api";
import { getStatusMessage } from "@/shared/config";
import { CreateStoreInput } from "../model/types";

type CreateStoreApplicationParams = {
  createStoreInput: CreateStoreInput;
};

/**
 * 店舗申請を作成するAPI
 */
export async function createStoreApplication({
  createStoreInput,
}: CreateStoreApplicationParams) {
  const { image, ...storeApplication } = createStoreInput;
  const uploadResult = await uploadImage(image);

  if (uploadResult.data === undefined) {
    throw new Error(uploadResult.error);
  }

  const client = await createApiClient();
  const { data, error, response } = await client.POST("/store-applications", {
    body: {
      ...storeApplication,
      imageObjectKey: uploadResult.data.imageObjectKey,
      // TODO: フォームにモバイルオーダーの有効・無効の入力を追加し、その値を送信する。
      orderEnabled: true,
    },
  });

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return { data };
}
