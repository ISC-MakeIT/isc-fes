import { getStatusMessage } from "@/shared/config";
import { buildFormDataBody } from "@/shared/lib/build-form-data-body";
import type { components } from "./schema";
import { createApiClient } from "./openapi-fetch/client";

type UploadImageResponse = components["schemas"]["UploadImageResponse"];

export type UploadImageResult =
  | { data: UploadImageResponse; error?: never }
  | { data?: never; error: string };

export async function uploadImage(image: File): Promise<UploadImageResult> {
  const client = await createApiClient();
  const { data, error, response } = await client.POST("/images", {
    body: { image } as never,
    bodySerializer: (body) => buildFormDataBody(body),
  });

  if (error) {
    return { error: getStatusMessage(response.status) };
  }

  return { data };
}
