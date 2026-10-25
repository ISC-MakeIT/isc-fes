import "server-only";
import { Pool } from "pg";
import type { PoolClient } from "pg";

const globalDB = globalThis as typeof globalThis & { analyticsPool?: Pool };
function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!globalDB.analyticsPool) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      application_name: "isc-fes-analytics",
    });
    pool.on("error", () => console.error("Analytics database connection closed unexpectedly."));
    globalDB.analyticsPool = pool;
  }
  return globalDB.analyticsPool;
}
export async function readSnapshot<T>(read: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  let failure: Error | undefined;
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '40s'");
    await client.query("SET LOCAL TIME ZONE 'Asia/Tokyo'");
    const result = await read(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      failure = new Error("Rollback failed");
    }
    throw error;
  } finally {
    client.release(failure);
  }
}
