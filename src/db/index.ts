import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url =
  process.env.TURSO_DATABASE_URL ||
  "libsql://financeiro-bernardomerlo.aws-us-east-2.turso.io";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });

let schemaReadyPromise: Promise<void> | null = null;

async function ensureColumnsExist(
  tableName: string,
  columnsToAdd: Array<{ name: string; definition: string }>
) {
  const info = await client.execute(`PRAGMA table_info(${tableName})`);
  const existingNames = new Set(
    info.rows.map((row) => String(row.name || "").toLowerCase())
  );

  for (const col of columnsToAdd) {
    if (!existingNames.has(col.name.toLowerCase())) {
      await client.execute(
        `ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.definition}`
      );
    }
  }
}

async function runSchemaMigration() {
  await client.batch(
    [
      // Finance module
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

      // Health module
      `CREATE TABLE IF NOT EXISTS health_sleeps (
        uid TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        sleep_score INTEGER,
        device TEXT NOT NULL DEFAULT 'android-samsung-health',
        notes TEXT,
        is_manual_override INTEGER NOT NULL DEFAULT 0,
        synced_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_health_sleeps_date ON health_sleeps(date)`,
      `CREATE TABLE IF NOT EXISTS health_exercises (
        uid TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        exercise_type TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        calories_kcal REAL,
        distance_meters REAL,
        device TEXT NOT NULL DEFAULT 'android-samsung-health',
        notes TEXT,
        is_manual_override INTEGER NOT NULL DEFAULT 0,
        synced_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_health_exercises_date ON health_exercises(date)`,
      `CREATE TABLE IF NOT EXISTS health_sync_logs (
        id TEXT PRIMARY KEY,
        device TEXT NOT NULL DEFAULT 'android-samsung-health',
        synced_at TEXT NOT NULL,
        sleeps_received INTEGER NOT NULL DEFAULT 0,
        sleeps_upserted INTEGER NOT NULL DEFAULT 0,
        exercises_received INTEGER NOT NULL DEFAULT 0,
        exercises_upserted INTEGER NOT NULL DEFAULT 0,
        raw_payload TEXT,
        created_at TEXT NOT NULL
      )`,

      // BuJo module
      `CREATE TABLE IF NOT EXISTS bujo_days (
        date TEXT PRIMARY KEY,
        yesterday_note TEXT,
        today_note TEXT NOT NULL DEFAULT '',
        gym_override INTEGER,
        cardio_override INTEGER,
        vitamin INTEGER NOT NULL DEFAULT 0,
        reading_override INTEGER,
        sleep_minutes_override INTEGER,
        sleep_score_override INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS bujo_months (
        year_month TEXT PRIMARY KEY,
        considerations_markdown TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS bujo_tasks (
        id TEXT PRIMARY KEY,
        date TEXT,
        year INTEGER NOT NULL,
        month INTEGER,
        parent_id TEXT,
        title TEXT NOT NULL,
        url TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        source TEXT NOT NULL DEFAULT 'daily',
        sort_order INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_bujo_tasks_date ON bujo_tasks(date)`,
      `CREATE INDEX IF NOT EXISTS idx_bujo_tasks_year_source ON bujo_tasks(year, source)`,
      `CREATE INDEX IF NOT EXISTS idx_bujo_tasks_parent ON bujo_tasks(parent_id)`,
      `CREATE TABLE IF NOT EXISTS bujo_entity_links (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        target_raw TEXT NOT NULL,
        target_slug TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_bujo_entity_links_source ON bujo_entity_links(source_type, source_id)`,
      `CREATE INDEX IF NOT EXISTS idx_bujo_entity_links_target ON bujo_entity_links(target_slug)`,
    ],
    "write"
  );

  // Safe column upgrades for previously created health tables
  await Promise.all([
    ensureColumnsExist("health_sleeps", [
      { name: "notes", definition: "TEXT" },
      { name: "is_manual_override", definition: "INTEGER NOT NULL DEFAULT 0" },
    ]),
    ensureColumnsExist("health_exercises", [
      { name: "notes", definition: "TEXT" },
      { name: "is_manual_override", definition: "INTEGER NOT NULL DEFAULT 0" },
    ]),
  ]);

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

export async function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = runSchemaMigration().catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }
  return schemaReadyPromise;
}
