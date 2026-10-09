import { createApiClient } from "@/shared/api";
import { getStatusMessage } from "@/shared/config";

type CreateReviewParams = {
  rating: number;
  comment?: string;
  trigger: string;
};

export async function createReview(input: CreateReviewParams) {
  const client = await createApiClient();

  const { data, error, response } = await client.POST("/reviews", {
    body: input,
  });

  if (error) {
    throw new Error(getStatusMessage(response.status));
  }

  return data;
}
