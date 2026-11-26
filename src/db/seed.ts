import { client, db, ensureSchema } from "./index";
import {
  settings,
  transactions,
  dailyOverrides,
  recurringRules,
  recurringOccurrences,
} from "./schema";

async function seed() {
  console.log("Ensuring schema and resetting data to match spreadsheet values...");
  await ensureSchema();

  await db.delete(transactions);
  await db.delete(dailyOverrides);
  await db.delete(recurringRules);
  await db.delete(recurringOccurrences);

  const defaultSettings = [
    { key: "initial_balance", value: "6095.16" },
    { key: "initial_balance_date", value: "2026-09-30" },
    { key: "daily_spending_target", value: "50.00" },
    { key: "credit_card_closing_day", value: "20" },
    { key: "credit_card_due_day", value: "27" },
  ];

  for (const s of defaultSettings) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      args: [s.key, s.value],
    });
  }

  const now = new Date().toISOString();

  // Exact Entrada & Saída entries from the user's spreadsheet (Outubro, Novembro, Dezembro 2026)
  const rawMovements: Array<{
    date: string;
    income?: number;
    expense?: number;
  }> = [
    // OUTUBRO 2026
    { date: "2026-10-01", income: 7.98, expense: 2970.63 },
    { date: "2026-10-05", income: 0.06 },
    { date: "2026-10-06", income: 100.0 },
    { date: "2026-10-09", expense: 371.25 },
    { date: "2026-10-10", income: 150.0, expense: 89.25 },
    { date: "2026-10-11", expense: 55.0 },
    { date: "2026-10-12", expense: 107.17 },
    { date: "2026-10-14", income: 57.3 },
    { date: "2026-10-15", income: 22.92, expense: 27.5 },
    { date: "2026-10-17", expense: 420.38 },
    { date: "2026-10-18", expense: 47.66 },
    { date: "2026-10-19", expense: 113.34 },
    { date: "2026-10-20", expense: 37.64 },
    { date: "2026-10-22", expense: 43.38 },
    { date: "2026-10-23", income: 3.24, expense: 18.83 },
    { date: "2026-10-25", expense: 154.06 },
    { date: "2026-10-27", expense: 71.14 },
    { date: "2026-10-28", income: 5171.08, expense: 49.35 },
    { date: "2026-10-30", expense: 55.0 },
    { date: "2026-10-31", expense: 229.9 },

    // NOVEMBRO 2026
    { date: "2026-11-01", income: 5.32, expense: 734.73 },
    { date: "2026-11-02", expense: 130.0 },
    { date: "2026-11-04", expense: 771.57 },
    { date: "2026-11-06", expense: 455.89 },
    { date: "2026-11-09", expense: 44.0 },
    { date: "2026-11-10", expense: 33.98 },
    { date: "2026-11-13", income: 60.2, expense: 37.56 },
    { date: "2026-11-15", expense: 482.94 },
    { date: "2026-11-16", income: 25.77, expense: 26.77 },
    { date: "2026-11-18", expense: 247.87 },
    { date: "2026-11-19", income: 50.0, expense: 127.42 },
    { date: "2026-11-20", expense: 99.26 },
    { date: "2026-11-23", expense: 41.82 },
    { date: "2026-11-24", expense: 10.0 },
    { date: "2026-11-30", income: 5171.08 },

    // DEZEMBRO 2026
    { date: "2026-12-01", expense: 1219.77 },
    { date: "2026-12-02", expense: 600.0 },
    { date: "2026-12-04", expense: 130.0 },
    { date: "2026-12-10", expense: 44.0 },
    { date: "2026-12-31", income: 5171.08 },
  ];

  for (const m of rawMovements) {
    if (m.income !== undefined && m.income > 0) {
      await db.insert(transactions).values({
        id: `tx_in_${m.date}`,
        date: m.date,
        type: "income",
        amount: m.income,
        description: null,
        category: null,
        paymentMethod: "cash",
        isSimulation: 0,
        isReconciled: m.date <= "2026-11-24" ? 1 : 0,
        createdAt: now,
      });
    }
    if (m.expense !== undefined && m.expense > 0) {
      await db.insert(transactions).values({
        id: `tx_out_${m.date}`,
        date: m.date,
        type: "expense_fixed",
        amount: m.expense,
        description: null,
        category: null,
        paymentMethod: "cash",
        isSimulation: 0,
        isReconciled: m.date <= "2026-11-24" ? 1 : 0,
        createdAt: now,
      });
    }
  }

  // Exact Diário column values from the spreadsheet for October and November
  // (December uses the default 50.00/day target on all 31 days)
  const exactDailyValues: Record<string, number> = {
    // OUTUBRO 2026
    "2026-10-01": 27.0,
    "2026-10-02": 66.79,
    "2026-10-03": 115.66,
    "2026-10-04": 35.99,
    "2026-10-05": 53.27,
    "2026-10-06": 28.0,
    "2026-10-07": 45.0,
    "2026-10-08": 94.32,
    "2026-10-09": 0,
    "2026-10-10": 0,
    "2026-10-11": 0,
    "2026-10-12": 0,
    "2026-10-13": 28.0,
    "2026-10-14": 28.0,
    "2026-10-15": 38.0,
    "2026-10-16": 33.0,
    "2026-10-17": 48.87,
    "2026-10-18": 0,
    "2026-10-19": 28.0,
    "2026-10-20": 28.0,
    "2026-10-21": 35.0,
    "2026-10-22": 28.0,
    "2026-10-23": 28.0,
    "2026-10-24": 0,
    "2026-10-25": 0,
    "2026-10-26": 28.0,
    "2026-10-27": 28.0,
    "2026-10-28": 38.0,
    "2026-10-29": 38.0,
    "2026-10-30": 0,
    "2026-10-31": 0,

    // NOVEMBRO 2026
    "2026-11-01": 0,
    "2026-11-02": 87.35,
    "2026-11-03": 37.47,
    "2026-11-04": 94.49,
    "2026-11-05": 28.0,
    "2026-11-06": 28.0,
    "2026-11-07": 197.45,
    "2026-11-08": 35.89,
    "2026-11-09": 28.0,
    "2026-11-10": 55.54,
    "2026-11-11": 50.0,
    "2026-11-12": 38.0,
    "2026-11-13": 28.0,
    "2026-11-14": 42.24,
    "2026-11-15": 64.99,
    "2026-11-16": 49.3,
    "2026-11-17": 28.0,
    "2026-11-18": 28.0,
    "2026-11-19": 83.42,
    "2026-11-20": 80.17,
    "2026-11-21": 102.07,
    "2026-11-22": 50.0,
    "2026-11-23": 28.0,
    "2026-11-24": 28.0,
    "2026-11-25": 28.0,
    "2026-11-26": 28.0,
    "2026-11-27": 28.0,
    "2026-11-28": 50.0,
    "2026-11-29": 50.0,
    "2026-11-30": 28.0,
  };

  for (const [date, amount] of Object.entries(exactDailyValues)) {
    // Only seed historical daily values up to the spreadsheet snapshot date (RN-06)
    if (amount > 0 && date <= "2026-11-24") {
      await db.insert(transactions).values({
        id: `tx_daily_${date}`,
        date,
        type: "expense_daily",
        amount,
        description: "Diário (Planilha)",
        category: null,
        paymentMethod: "cash",
        purchaseDate: date,
        isSimulation: 0,
        isReconciled: 1,
        createdAt: now,
      });
    }
  }

  console.log("Spreadsheet values seeded successfully into Turso!");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
