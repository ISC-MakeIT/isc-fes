/**
 * rooms テーブルへ教室の初期データを登録するスクリプト。
 *
 * 仕様:
 * - 接続先のデフォルトはローカル開発環境。
 * - DATABASE_URL が指定されている場合は、そのURLを接続先として使用する。
 * - POSTGRES_USER と POSTGRES_PASSWORD が指定されている場合は、URL内の認証情報を上書きする。
 * - RESET のデフォルトは false。false の場合は教室名をキーとして登録または並び順を更新する。
 * - RESET=true の場合は、トランザクション内で rooms の全データを削除してから登録し直す。
 * - RESET には true または false のみ指定できる。
 *
 * 使用方法:
 *   bun run scripts/insert-initial-rooms.ts
 *   RESET=true bun run scripts/insert-initial-rooms.ts
 *   DATABASE_URL="postgres://host:5432/database?sslmode=require" \
 *     POSTGRES_USER="user" POSTGRES_PASSWORD="password" \
 *     bun run scripts/insert-initial-rooms.ts
 *
 * 注意:
 * RESET=true の実行時に既存店舗が教室を参照している場合は、外部キー制約により削除が失敗する。
 * 削除または登録に失敗した場合、トランザクション全体がロールバックされる。
 */
import { SQL } from "bun";

const DEFAULT_DATABASE_URL =
  "postgres://isc-fes:devpassword@localhost:5432/isc-fes?sslmode=disable";

const initialRooms = [
  { name: "1F", sort_order: 0 },
  { name: "501", sort_order: 501 },
  { name: "502", sort_order: 502 },
  { name: "503", sort_order: 503 },
  { name: "504", sort_order: 504 },
  { name: "505", sort_order: 505 },
  { name: "506", sort_order: 506 },
  { name: "507", sort_order: 507 },
  { name: "508", sort_order: 508 },
  { name: "509", sort_order: 509 },
  { name: "601", sort_order: 601 },
  { name: "602", sort_order: 602 },
  { name: "603", sort_order: 603 },
  { name: "604", sort_order: 604 },
  { name: "605", sort_order: 605 },
  { name: "606", sort_order: 606 },
  { name: "607", sort_order: 607 },
  { name: "608", sort_order: 608 },
  { name: "707", sort_order: 707 },
  { name: "iCrossArena", sort_order: 999 },
  { name: "8Fステージ", sort_order: 1000 },
] satisfies ReadonlyArray<{ name: string; sort_order: number }>;

function resolveDatabaseUrl(): URL {
  const url = new URL(Bun.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);

  if (Bun.env.POSTGRES_USER !== undefined) {
    url.username = Bun.env.POSTGRES_USER;
  }

  if (Bun.env.POSTGRES_PASSWORD !== undefined) {
    url.password = Bun.env.POSTGRES_PASSWORD;
  }

  return url;
}

function maskCredentials(url: URL): string {
  const masked = new URL(url);
  const username = decodeURIComponent(masked.username);
  const password = decodeURIComponent(masked.password);

  masked.username = "*".repeat(Array.from(username).length);
  masked.password = "*".repeat(Array.from(password).length);

  return masked.toString();
}

function shouldReset(): boolean {
  const reset = Bun.env.RESET?.trim().toLowerCase() ?? "false";

  if (reset !== "true" && reset !== "false") {
    throw new Error('RESET には "true" または "false" を指定してください');
  }

  return reset === "true";
}

async function main(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  const db = new SQL({
    url: databaseUrl.toString(),
    max: 1,
  });
  const reset = shouldReset();

  try {
    const rooms = await db.begin(async (tx) => {
      if (reset) {
        await tx`DELETE FROM rooms`;
      }

      return tx`
        INSERT INTO rooms ${tx(initialRooms)}
        ON CONFLICT (name) DO UPDATE
        SET sort_order = EXCLUDED.sort_order
        RETURNING name, sort_order
      `;
    });

    const operation = reset ? "全件削除後に登録しました" : "登録または更新しました";
    console.log(`${rooms.length}件の教室を${operation}。接続先: ${maskCredentials(databaseUrl)}`);
  } finally {
    await db.close();
  }
}

try {
  await main();
} catch (error) {
  console.error("教室の初期データ登録に失敗しました:", error);
  process.exitCode = 1;
}
