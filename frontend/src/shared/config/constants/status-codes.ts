export const STATUS_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export function getErrorMessage(status: number): string {
  switch (status) {
    case STATUS_CODES.BAD_REQUEST:
      return "入力内容に誤りがあります。内容をご確認ください。";
    case STATUS_CODES.UNAUTHORIZED:
      return "未ログインです。再度ログインしてからお試しください。";
    case STATUS_CODES.FORBIDDEN:
      return "この操作を行う権限がありません";
    case STATUS_CODES.NOT_FOUND:
      return "対象が見つかりません";
    case STATUS_CODES.CONFLICT:
      return "既に登録されている内容と重複しています。内容をご確認ください。";
    case STATUS_CODES.PAYLOAD_TOO_LARGE:
      return "アップロードされたファイルのサイズが大きすぎます。10MB以下のサイズを指定してください。";
    case STATUS_CODES.UNSUPPORTED_MEDIA_TYPE:
      return "対応していない形式のファイルです。";
    case STATUS_CODES.UNPROCESSABLE_ENTITY:
      return "入力内容を処理できませんでした。必須項目や形式をご確認ください。";

    // ここより下は500番台がくる想定
    default:
      return "エラーが発生しました。時間を置いて再度試してください。";
  }
}

/**
 * 400番台かどうかを判定
 * @param status
 * @returns
 */
export function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}
