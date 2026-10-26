/**
 * 店舗の注文をCSVに出力する。
 * bun run export:orders <店舗UUID> [出力ディレクトリ]
 *
 * 接続先はローカル開発DBが既定。DATABASE_URL、POSTGRES_USER、
 * POSTGRES_PASSWORDで変更可能。日時は日本時間（+09:00）、NULLは空欄。
 * orders.csv、order_items.csv、order_item_toppings.csvを同じスナップショットから出力。
 * 存在しない店舗はエラー。注文0件はヘッダーのみ。既存ディレクトリは上書きしない。
 */
import { SQL } from "bun";
import { mkdir, rm, rmdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const DEFAULT_DATABASE_URL =
  "postgres://isc-fes:devpassword@localhost:5432/isc-fes?sslmode=disable";

export const ORDER_COLUMNS = [
  "id",
  "status",
  "total_amount",
  "display_number",
  "ready_at",
  "completed_at",
  "cancelled_at",
  "created_at",
] as const;

export const ITEM_COLUMNS = [
  "id", "order_id", "menu_id", "menu_name", "unit_price", "quantity",
] as const;
export const TOPPING_COLUMNS = [
  "order_id", "order_item_id", "topping_id", "topping_name", "unit_price",
] as const;

type CsvRow<C extends readonly string[]> = Record<C[number], string | null>;
type OrderRow = CsvRow<typeof ORDER_COLUMNS>;
type ItemRow = CsvRow<typeof ITEM_COLUMNS>;
type ToppingRow = CsvRow<typeof TOPPING_COLUMNS>;
type OrderExport = { orders: OrderRow[]; items: ItemRow[]; toppings: ToppingRow[] };

export function toCsv<C extends readonly string[]>(columns: C, rows: readonly CsvRow<C>[]): string {
  const escape = (value: string | null): string => {
    if (value === null) return "";
    return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  };
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escape(row[column as C[number]])).join(",")),
    "",
  ].join("\r\n");
}

export async function exportStoreOrders(db: SQL, storeId: string): Promise<OrderExport> {
  return db.begin(async (tx) => {
    await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`;
    await tx`SET LOCAL statement_timeout = '60s'`;

    const stores = await tx`SELECT id FROM stores WHERE id = ${storeId}::uuid`;
    if (stores.length === 0) throw new Error("指定された店舗が存在しません");

    // bigintと日時を文字列で取得し、JSの数値・Date変換による精度の欠落を防ぐ。
    const orders = await tx<OrderRow[]>`
      SELECT
        id::text,
        status::text,
        total_amount::text,
        display_number::text,
        to_char(ready_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '+09:00' AS ready_at,
        to_char(completed_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '+09:00' AS completed_at,
        to_char(cancelled_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '+09:00' AS cancelled_at,
        to_char(created_at AT TIME ZONE 'Asia/Tokyo', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '+09:00' AS created_at
      FROM orders
      WHERE store_id = ${storeId}::uuid
      ORDER BY created_at, id
    `;

    // 現在のmenus/toppingsではなく、注文時点の名前・単価を使う。
    const items = await tx<ItemRow[]>`
      SELECT i.id::text, i.order_id::text, i.menu_id::text, i.menu_name,
        i.unit_price::text, i.quantity::text
      FROM order_items i
      JOIN orders o ON o.id = i.order_id AND o.store_id = i.store_id
      WHERE o.store_id = ${storeId}::uuid
      ORDER BY o.created_at, o.id, i.id
    `;
    const toppings = await tx<ToppingRow[]>`
      SELECT i.order_id::text, t.order_item_id::text, t.topping_id::text,
        t.topping_name, t.unit_price::text
      FROM order_item_toppings t
      JOIN order_items i ON i.id = t.order_item_id AND i.store_id = t.store_id
      JOIN orders o ON o.id = i.order_id AND o.store_id = i.store_id
      WHERE o.store_id = ${storeId}::uuid
      ORDER BY o.created_at, o.id, i.id, t.topping_id
    `;
    return { orders, items, toppings };
  });
}

export async function writeOrderExports(outputPath: string, data: OrderExport): Promise<void> {
  const files = [
    ["orders.csv", toCsv(ORDER_COLUMNS, data.orders)],
    ["order_items.csv", toCsv(ITEM_COLUMNS, data.items)],
    ["order_item_toppings.csv", toCsv(TOPPING_COLUMNS, data.toppings)],
  ] as const;
  // recursiveを使わず、既存ディレクトリがあれば失敗させる。
  await mkdir(outputPath);
  try {
    for (const [name, content] of files) {
      await writeFile(join(outputPath, name), content, { encoding: "utf8", flag: "wx" });
    }
  } catch (error) {
    // 今回作成したファイルだけを片付ける。他のファイルがあればディレクトリを残す。
    for (const [name] of files) await rm(join(outputPath, name), { force: true }).catch(() => {});
    await rmdir(outputPath).catch(() => {});
    throw error;
  }
}

const usage = `店舗の注文をCSVに出力:
  bun run export:orders <店舗UUID> [出力ディレクトリ]

例:
  bun run export:orders 12345678-1234-1234-1234-123456789abc ./order-export

出力先省略時: ./orders-<店舗UUID>/
orders.csv: ${ORDER_COLUMNS.join(", ")}
order_items.csv: ${ITEM_COLUMNS.join(", ")}
order_item_toppings.csv: ${TOPPING_COLUMNS.join(", ")}
メニュー・カスタマイズの名前と単価は注文時点の値。
カスタマイズのunit_priceは商品1個あたりの追加料金（数量は注文明細のquantity）。
日時は日本時間（+09:00）、未設定は空欄。文字コードはUTF-8。
注文は作成日時の昇順。既存ディレクトリは上書きしません。親ディレクトリは事前に作成してください。
接続先はローカル開発DBが既定。DATABASE_URLで変更できます。
POSTGRES_USER / POSTGRES_PASSWORDで接続URLの認証情報を上書きできます。`;

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0]!)) {
    console.log(usage);
    return;
  }
  const [storeId, output] = args;
  if (args.length < 1 || args.length > 2 || !storeId) throw new Error(usage);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeId)) {
    throw new Error("店舗IDにはUUIDを指定してください");
  }

  let url: URL;
  try {
    url = new URL(Bun.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URLが有効なURLではありません");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length <= 1) {
    throw new Error("DATABASE_URLにはホストとDB名を含むPostgreSQL接続URLを指定してください");
  }
  if (Bun.env.POSTGRES_USER !== undefined) url.username = encodeURIComponent(Bun.env.POSTGRES_USER);
  if (Bun.env.POSTGRES_PASSWORD !== undefined) url.password = encodeURIComponent(Bun.env.POSTGRES_PASSWORD);

  const outputPath = resolve(output ?? `orders-${storeId}`);
  const db = new SQL({ url: url.toString(), max: 1, connectionTimeout: 10 });
  try {
    const data = await exportStoreOrders(db, storeId);
    await writeOrderExports(outputPath, data);
    console.log(`注文${data.orders.length}件・明細${data.items.length}件・カスタマイズ${data.toppings.length}件を出力しました: ${outputPath}`);
  } finally {
    await db.close();
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    if (error instanceof SQL.SQLError) {
      // 接続URLや認証情報を含み得るDBエラーの全文は表示しない。
      console.error("DBへの接続または注文の取得に失敗しました。接続設定とDBの状態を確認してください。");
    } else if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      console.error("出力先が既に存在します。別の出力ディレクトリを指定してください。");
    } else {
      console.error(error instanceof Error ? error.message : "CSVの出力に失敗しました");
    }
    process.exitCode = 1;
  }
}
