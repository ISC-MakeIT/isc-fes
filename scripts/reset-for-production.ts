/**
 * 本番開始前の初期化を行うスクリプト。
 * 注文・カート・ゲスト・アプリレビュー・注文番号カウンターの全データを削除する。
 * データの種類にかかわらず、対象テーブルの全レコードを削除する。
 * 指定したテスト店舗と、その所属・商品・関連付け・招待も削除する。
 * デフォルトは件数確認のみ。--execute を指定した場合だけ削除する。
 * 使用前にバックアップを取得し、バックエンドを停止すること。
 * 接続先は DATABASE_URL で明示する。他店舗・商品・運営アカウントは変更しない。
 */
import { SQL } from "bun";

// 本番開始前に初期化するテーブルの固定リスト。
// これらのテーブルだけを全件初期化する。他のテーブルへTRUNCATE CASCADEは行わない。
const TARGET_TABLES = [
  "order_item_toppings",
  "order_items",
  "orders",
  "store_order_counters",
  "cart_item_toppings",
  "cart_items",
  "carts",
  "reviews",
  "guest_sessions",
  "guests",
] as const;

const TEST_STORE_IDS = [
  "47076dd0-6a80-430f-b182-783bd534078f",
  "443bee08-0acd-4d76-8f72-c9a0dd750084",
];
// テスト店舗だけを削除する。子テーブルは店舗のDELETEからON DELETE CASCADEで削除される。
const TEST_STORE_TABLES = [
  "stores",
  "store_members",
  "menus",
  "toppings",
  "menu_toppings",
  "store_allergens",
  "store_invitations",
] as const;

type TableCount = { table_name: string; count: string };
type ResetResult = { before: TableCount[]; after: TableCount[] | null };

// unsafeに渡すSQLは固定のテーブル名だけから作る。店舗IDはパラメータとして渡す。
const tableList = TARGET_TABLES.map((name) => `public.${name}`).join(", ");
const lockTableList = [...TARGET_TABLES, ...TEST_STORE_TABLES]
  .map((name) => `public.${name}`)
  .join(", ");
const countQuery = [
  ...TARGET_TABLES.map(
    (name) => `SELECT '${name}' AS table_name, count(*)::text AS count FROM public.${name}`,
  ),
  ...TEST_STORE_TABLES.map(
    (name) => `SELECT '${name} (テスト店舗)' AS table_name, count(*)::text AS count FROM public.${name} WHERE ${name === "stores" ? "id" : "store_id"} = ANY($1::uuid[])`,
  ),
].join(" UNION ALL ");

export async function resetForProduction(
  db: SQL,
  options: { execute: boolean },
): Promise<ResetResult> {
  return db.begin(async (tx) => {
    if (!options.execute) {
      // 件数確認は同じスナップショットを使い、DBの変更も禁止する。
      await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`;
    }
    await tx`SET LOCAL lock_timeout = '5s'`;
    await tx`SET LOCAL statement_timeout = '60s'`;

    if (options.execute) {
      // 件数確認からコミットまで書き込みを防ぐ。ロックを取得できなければ中断する。
      await tx.unsafe(`LOCK TABLE ${lockTableList} IN ACCESS EXCLUSIVE MODE`);
    }

    const storeIDs = tx.array(TEST_STORE_IDS, "UUID");
    const before = await tx.unsafe<TableCount[]>(countQuery, [storeIDs]);
    if (!options.execute) return { before, after: null };

    // 全対象を同時に指定して外部キーを満たす。未指定の参照元があればRESTRICTで失敗する。
    // カウンターも空になるため、次の注文のdisplay_numberは店舗ごとに1から始まる。
    await tx.unsafe(`TRUNCATE TABLE ${tableList} RESTRICT`);
    // 注文・カート・カウンターのRESTRICT参照を消した後、テスト店舗とCASCADE対象を削除する。
    await tx`DELETE FROM public.stores WHERE id = ANY(${storeIDs}::uuid[])`;
    const after = await tx.unsafe<TableCount[]>(countQuery, [storeIDs]);
    if (after.some((row) => row.count !== "0")) {
      throw new Error("削除対象にデータが残っているため、ロールバックします");
    }
    return { before, after };
  });
}

const usage = `本番開始前の初期化:
  DATABASE_URL="postgres://host:5432/database" bun run reset-for-production
  DATABASE_URL="postgres://host:5432/database" bun run reset-for-production --execute

通常実行は件数確認のみ。--execute を指定すると、対象テーブルの全データとテスト店舗を削除します。
対象: 注文・カート・ゲスト・アプリレビュー・注文番号カウンター。
テスト店舗: ${TEST_STORE_IDS.join(", ")}（所属・メニュー・トッピング・関連付け・招待も削除）。
POSTGRES_USER / POSTGRES_PASSWORD が指定されていれば接続URLの認証情報を上書きします。
他店舗のデータとアレルゲン・教室・アカウント・ログインは保持します。
売り切れ・閉店・混雑度・注文受付の設定とS3の画像は変更しません。
削除前にバックアップを取得し、バックエンドを停止してください。`;

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  if (args.some((arg) => !["--execute", "--help", "-h"].includes(arg))) {
    throw new Error("不明な引数です。--help で使用方法を確認してください");
  }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    return;
  }

  const value = Bun.env.DATABASE_URL;
  if (!value?.trim()) throw new Error("DATABASE_URL を指定してください");
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(value);
  } catch {
    throw new Error("DATABASE_URL が有効なURLではありません");
  }
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("DATABASE_URL にはPostgreSQLの接続URLを指定してください");
  }
  if (!databaseUrl.hostname || databaseUrl.pathname.length <= 1) {
    throw new Error("DATABASE_URL にホストとデータベース名を指定してください");
  }
  if (Bun.env.POSTGRES_USER !== undefined) {
    databaseUrl.username = encodeURIComponent(Bun.env.POSTGRES_USER);
  }
  if (Bun.env.POSTGRES_PASSWORD !== undefined) {
    databaseUrl.password = encodeURIComponent(Bun.env.POSTGRES_PASSWORD);
  }

  const execute = args.includes("--execute");
  // 認証情報や接続URLのクエリパラメータは表示しない。
  console.log(`接続先: ${databaseUrl.host}${databaseUrl.pathname}`);
  console.log(execute ? "本番開始前の初期化として、対象テーブルの全データとテスト店舗を削除します。" : "件数確認のみ実行します。DBは変更しません。");
  console.log(`削除対象のテスト店舗: ${TEST_STORE_IDS.join(", ")}`);
  const db = new SQL({ url: databaseUrl.toString(), max: 1, connectionTimeout: 10 });
  try {
    const result = await resetForProduction(db, { execute });
    console.table(
      result.before.map((row, index) => ({
        テーブル: row.table_name,
        実行前: row.count,
        ...(result.after ? { 実行後: result.after[index]!.count } : {}),
      })),
    );
    console.log(execute ? "本番開始前の初期化が完了しました。" : "初期化する場合は --execute を指定してください。");
  } finally {
    await db.close();
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    // 接続ライブラリのエラー全文には認証情報が含まれる可能性があるため表示しない。
    if (error instanceof SQL.PostgresError) {
      console.error(`処理に失敗しました (PostgreSQL ${error.errno ?? error.code})。削除はコミットされていません。`);
    } else if (error instanceof SQL.SQLError) {
      console.error("DBへの接続または処理に失敗しました。接続設定とDBの状態を確認してください。");
    } else {
      console.error(error instanceof Error ? error.message : "処理に失敗しました");
    }
    process.exitCode = 1;
  }
}
