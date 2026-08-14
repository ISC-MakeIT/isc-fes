export const STATUS = {
  BAD_REQUEST: {
    code: 400,
    message: "入力内容に誤りがあります。内容をご確認ください。",
  },
  UNAUTHORIZED: {
    code: 401,
    message: "未ログインです。再度ログインしてからお試しください。",
  },
  FORBIDDEN: {
    code: 403,
    message: "この操作を行う権限がありません",
  },
  NOT_FOUND: {
    code: 404,
    message: "対象が見つかりません",
  },
  CONFLICT: {
    code: 409,
    message: "既に登録されている内容と重複しています。内容をご確認ください。",
  },
  PAYLOAD_TOO_LARGE: {
    code: 413,
    message:
      "アップロードされたファイルのサイズが大きすぎます。10MB以下のサイズを指定してください。",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    code: 415,
    message: "対応していない形式のファイルです。",
  },
  UNPROCESSABLE_ENTITY: {
    code: 422,
    message: "入力内容を処理できませんでした。必須項目や形式をご確認ください。",
  },
  INTERNAL_SERVER_ERROR: {
    code: 500,
    message: "エラーが発生しました。時間を置いて再度試してください。",
  },
} as const;

/**
 * ステータスコードに対応するエラーメッセージを取得
 * @param status
 * @returns
 */
export function getStatusMessage(status: number): string {
  const entry = Object.values(STATUS).find((s) => s.code === status);

  return (
    entry?.message ?? "エラーが発生しました。時間を置いて再度試してください。"
  );
}

/**
 * 400番台かどうかを判定
 * @param status
 * @returns
 */
export function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}
