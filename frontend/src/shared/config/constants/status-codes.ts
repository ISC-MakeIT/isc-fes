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

export const GENERIC_ERROR_MESSAGE =
  "エラーが発生しました。時間を置いて再度試してください。";

/**
 * 400番台かどうかを判定
 * @param status
 * @returns
 */
export function isClientError(status: number): boolean {
  return status >= 400 && status < 600;
}
