import { Store } from "@/entities/store";
import { createApiClient, uploadImage, type components } from "@/shared/api";
import { getStatusMessage } from "@/shared/config";
import { v } from "@/shared/lib/valibot";

type UpdateStoreParams = {
  storeId: string;
  input: components["schemas"]["UpdateStoreInput"];
  image?: File;
};

export async function updateStore({
  storeId,
  input,
  image,
}: UpdateStoreParams) {
  const uploadResult = image && (await uploadImage(image));
  if (uploadResult && uploadResult.data === undefined) {
    throw new Error(uploadResult.error);
  }

  const client = await createApiClient();
  const { data, error, response } = await client.PATCH("/stores/{store_id}", {
    params: { path: { store_id: storeId } },
    body: {
      ...input,
      imageObjectKey: uploadResult?.data.imageObjectKey,
    },
  });

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return v.parse(Store, data);
}
