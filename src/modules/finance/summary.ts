import { and, eq, gte, lte } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { settings, transactions } from "./schema";

export interface FinanceDailySummary {
  date: string;
  dailySpent: number;
  fixedOut: number;
  income: number;
  dailyTarget: number;
  transactionCount: number;
}

export async function getFinanceDailySummaryMap(
  startDate: string,
  endDate: string
): Promise<Map<string, FinanceDailySummary>> {
  await ensureSchema();

  const [rawSettings, rows] = await Promise.all([
    db.select().from(settings),
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.isSimulation, 0),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      ),
  ]);

  const settingsMap = new Map(rawSettings.map((s) => [s.key, s.value]));
  const dailyTarget = Number(settingsMap.get("daily_spending_target") ?? "50.00");

  const map = new Map<string, FinanceDailySummary>();

  const ensureEntry = (date: string): FinanceDailySummary => {
    let entry = map.get(date);
    if (!entry) {
      entry = {
        date,
        dailySpent: 0,
        fixedOut: 0,
        income: 0,
        dailyTarget,
        transactionCount: 0,
      };
      map.set(date, entry);
    }
    return entry;
  };

  for (const tx of rows) {
    const entry = ensureEntry(tx.date);
    if (tx.amount > 0) {
      entry.transactionCount += 1;
    }
    if (tx.type === "expense_daily") {
      entry.dailySpent = Number((entry.dailySpent + tx.amount).toFixed(2));
    } else if (tx.type === "expense_fixed") {
      entry.fixedOut = Number((entry.fixedOut + tx.amount).toFixed(2));
    } else if (tx.type === "income") {
      entry.income = Number((entry.income + tx.amount).toFixed(2));
    }
  }

  return map;
}
