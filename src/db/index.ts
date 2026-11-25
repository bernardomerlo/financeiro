import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL || "libsql://financeiro-bernardomerlo.aws-us-east-2.turso.io";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });

export async function ensureSchema() {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        category TEXT,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        purchase_date TEXT,
        is_simulation INTEGER NOT NULL DEFAULT 0,
        is_reconciled INTEGER NOT NULL DEFAULT 1,
        installment_current INTEGER,
        installment_total INTEGER,
        installment_group_id TEXT,
        recurring_rule_id TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS daily_overrides (
        date TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        note TEXT,
        is_reconciled INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS recurring_rules (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT,
        day_of_month INTEGER NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        is_active INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS recurring_occurrences (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        year_month TEXT NOT NULL,
        status TEXT NOT NULL,
        modified_amount REAL
      )`,
    ],
    "write"
  );
}
