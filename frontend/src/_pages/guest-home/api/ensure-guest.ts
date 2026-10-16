import { createApiClient } from "@/shared/api";
import { getStatusMessage } from "@/shared/config";

// Strict Modeなどによる同時呼び出しで、未発行のセッションを重複作成しない。
let pending: Promise<void> | undefined;

export function ensureGuest(): Promise<void> {
  pending ??= issueGuest().finally(() => {
    pending = undefined;
  });
  return pending;
}

async function issueGuest(): Promise<void> {
  const client = await createApiClient();
  const { error, response } = await client.POST("/guests");
  if (error) {
    throw new Error(getStatusMessage(response.status));
  }
}
