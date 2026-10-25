import { InputError } from "@/lib/filters";

export const noStore = { "Cache-Control": "no-store" };
export function errorResponse(error: unknown) {
  if (error instanceof InputError)
    return Response.json({ error: error.message }, { status: 400, headers: noStore });
  const code = (error as { code?: string })?.code;
  let message = "DB に接続できません。DATABASE_URL と PostgreSQL の起動状態を確認してください。";
  if (error instanceof Error && error.message === "DATABASE_NOT_CONFIGURED")
    message =
      "接続先が未設定です。analytics/.env.example を .env.local にコピーし、DATABASE_URL を設定してください。";
  if (code === "42P01" || code === "42703")
    message =
      "必要なテーブル・列がありません。backend/db/migrations の 000025 まで適用された DB を指定してください。";
  if (code === "42501")
    message = "DB の参照権限がありません。対象テーブルの SELECT 権限を確認してください。";
  if (code === "57014")
    message = "集計が30秒を超えました。期間を短くするか、店舗を絞り込んでください。";
  console.error("Analytics request failed", { code: code ?? "connection/configuration" });
  return Response.json({ error: message }, { status: 503, headers: noStore });
}
