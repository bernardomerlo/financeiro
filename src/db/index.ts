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
      `CREATE TABLE IF NOT EXISTS mobile_notifications (
        id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL UNIQUE,
        app_package TEXT,
        app_name TEXT,
        title TEXT,
        message TEXT NOT NULL,
        original_timestamp TEXT NOT NULL,
        event_date TEXT NOT NULL,
        detected_type TEXT NOT NULL,
        parsed_amount REAL,
        parsed_merchant TEXT,
        parsed_payment_method TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        transaction_id TEXT,
        raw_payload TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_mobile_notifications_fingerprint ON mobile_notifications(fingerprint)`,
      `CREATE INDEX IF NOT EXISTS idx_mobile_notifications_status ON mobile_notifications(status)`,
      `CREATE INDEX IF NOT EXISTS idx_mobile_notifications_event_date ON mobile_notifications(event_date)`,
    ],
    "write"
  );

  // Migrate any legacy daily_overrides rows into individual expense_daily transactions (RN-03, RN-04, RN-06)
  const legacyOverrides = await client.execute(
    `SELECT date, amount, note, is_reconciled FROM daily_overrides`
  );
  if (legacyOverrides.rows.length > 0) {
    const now = new Date().toISOString();
    for (const row of legacyOverrides.rows) {
      const date = String(row.date);
      const amount = Number(row.amount ?? 0);
      const note = row.note ? String(row.note) : "Diário (Planilha)";
      const isReconciled = Number(row.is_reconciled ?? 1);
      if (amount > 0) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO transactions (
            id, date, type, amount, description, category, payment_method, purchase_date,
            is_simulation, is_reconciled, created_at
          ) VALUES (?, ?, 'expense_daily', ?, ?, NULL, 'cash', ?, 0, ?, ?)`,
          args: [
            `tx_daily_${date}`,
            date,
            amount,
            note,
            date,
            isReconciled,
            now,
          ],
        });
      }
    }
    await client.execute(`DELETE FROM daily_overrides`);
  }
}
