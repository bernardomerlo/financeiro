"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { client, db, ensureSchema } from "@/db";
import {
  AUTH_COOKIE_NAME,
  TWENTY_HOURS_SECONDS,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";
import {
  settings,
  transactions,
  dailyOverrides,
  recurringRules,
  recurringOccurrences,
  mobileNotifications,
} from "@/db/schema";
import {
  calculateCreditCardInstallmentDates,
  getTodayIsoDate,
  type CashflowSettings,
  type TransactionRecord,
  type DailyOverrideRecord,
  type RecurringRuleRecord,
  type RecurringOccurrenceRecord,
} from "@/lib/cashflow-engine";

export async function fetchInitialCashflowData(): Promise<{
  settings: CashflowSettings;
  transactions: TransactionRecord[];
  dailyOverrides: DailyOverrideRecord[];
  recurringRules: RecurringRuleRecord[];
  recurringOccurrences: RecurringOccurrenceRecord[];
}> {
  await ensureSchema();

  const [rawSettings, rawTx, rawOverrides, rawRules, rawOccurrences] = await Promise.all([
    db.select().from(settings),
    db.select().from(transactions),
    db.select().from(dailyOverrides),
    db.select().from(recurringRules),
    db.select().from(recurringOccurrences),
  ]);

  const settingsMap = new Map<string, string>();
  for (const s of rawSettings) {
    settingsMap.set(s.key, s.value);
  }

  const parsedSettings: CashflowSettings = {
    initialBalance: Number(settingsMap.get("initial_balance") ?? "6095.16"),
    initialBalanceDate: settingsMap.get("initial_balance_date") ?? "2026-09-30",
    dailySpendingTarget: Number(settingsMap.get("daily_spending_target") ?? "50.00"),
    creditCardClosingDay: Number(settingsMap.get("credit_card_closing_day") ?? "20"),
    creditCardDueDay: Number(settingsMap.get("credit_card_due_day") ?? "27"),
    referenceToday: getTodayIsoDate(new Date(), process.env.APP_TIMEZONE || undefined),
  };

  return {
    settings: parsedSettings,
    transactions: rawTx.map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type as TransactionRecord["type"],
      amount: t.amount,
      description: t.description,
      category: t.category,
      paymentMethod: (t.paymentMethod as TransactionRecord["paymentMethod"]) || "cash",
      purchaseDate: t.purchaseDate,
      isSimulation: Boolean(t.isSimulation),
      isReconciled: Boolean(t.isReconciled),
      installmentCurrent: t.installmentCurrent,
      installmentTotal: t.installmentTotal,
      installmentGroupId: t.installmentGroupId,
      recurringRuleId: t.recurringRuleId,
    })),
    dailyOverrides: rawOverrides.map((o) => ({
      date: o.date,
      amount: o.amount,
      note: o.note,
      isReconciled: Boolean(o.isReconciled),
    })),
    recurringRules: rawRules.map((r) => ({
      id: r.id,
      title: r.title,
      amount: r.amount,
      type: r.type as RecurringRuleRecord["type"],
      category: r.category,
      dayOfMonth: r.dayOfMonth,
      paymentMethod: (r.paymentMethod as RecurringRuleRecord["paymentMethod"]) || "cash",
      isActive: Boolean(r.isActive),
    })),
    recurringOccurrences: rawOccurrences.map((occ) => ({
      id: occ.id,
      ruleId: occ.ruleId,
      yearMonth: occ.yearMonth,
      status: occ.status as RecurringOccurrenceRecord["status"],
      modifiedAmount: occ.modifiedAmount,
    })),
  };
}

export interface CreateTransactionPayload {
  date: string;
  type: "income" | "expense_fixed" | "expense_daily";
  amount: number;
  description?: string;
  category?: string;
  paymentMethod: "cash" | "credit_card";
  installments: number;
  isSimulation: boolean;
}

export async function createRealTransactionAction(payload: CreateTransactionPayload) {
  await ensureSchema();

  const rawSettings = await db.select().from(settings);
  const settingsMap = new Map(rawSettings.map((s) => [s.key, s.value]));
  const closingDay = Number(settingsMap.get("credit_card_closing_day") ?? "20");
  const dueDay = Number(settingsMap.get("credit_card_due_day") ?? "27");

  const now = new Date().toISOString();
  const installmentsCount =
    payload.paymentMethod === "credit_card" ? Math.max(1, payload.installments) : 1;

  const targetDates =
    payload.paymentMethod === "credit_card"
      ? calculateCreditCardInstallmentDates(payload.date, installmentsCount, closingDay, dueDay)
      : [payload.date];

  const perInstallmentAmount = Number((payload.amount / installmentsCount).toFixed(2));
  const groupId = installmentsCount > 1 ? `grp_${ crypto.randomUUID() }` : null;

  const rowsToInsert = targetDates.map((effectiveDate, idx) => ({
    id: `tx_${crypto.randomUUID()}`,
    date: effectiveDate,
    type: payload.type,
    amount: perInstallmentAmount,
    description: payload.description || null,
    category: payload.category || null,
    paymentMethod: payload.paymentMethod,
    purchaseDate: payload.date,
    isSimulation: payload.isSimulation ? 1 : 0,
    isReconciled: 1,
    installmentCurrent: installmentsCount > 1 ? idx + 1 : null,
    installmentTotal: installmentsCount > 1 ? installmentsCount : null,
    installmentGroupId: groupId,
    recurringRuleId: null,
    createdAt: now,
  }));

  for (const row of rowsToInsert) {
    await db.insert(transactions).values(row);
  }

  revalidatePath("/");
  revalidatePath("/insights");
  return rowsToInsert;
}

export async function deleteTransactionAction(id: string) {
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath("/");
  revalidatePath("/insights");
}

export async function updateTransactionAmountAction(
  id: string,
  amount: number,
  description?: string
) {
  await client.execute({
    sql: `UPDATE transactions SET amount = ?, description = COALESCE(?, description) WHERE id = ?`,
    args: [amount, description ?? null, id],
  });
  revalidatePath("/");
  revalidatePath("/insights");
}

export async function updateTransactionAction(input: {
  id: string;
  amount: number;
  description?: string | null;
  category?: string | null;
  date?: string;
  type?: "income" | "expense_fixed" | "expense_daily";
  paymentMethod?: "cash" | "credit_card";
}) {
  await ensureSchema();
  const effectiveType = input.type ?? null;
  const effectiveMethod =
    effectiveType && effectiveType !== "expense_fixed"
      ? "cash"
      : input.paymentMethod ?? null;

  await client.execute({
    sql: `UPDATE transactions
          SET amount = ?,
              description = ?,
              category = ?,
              date = COALESCE(?, date),
              type = COALESCE(?, type),
              payment_method = COALESCE(?, payment_method)
          WHERE id = ?`,
    args: [
      Number(input.amount.toFixed(2)),
      input.description ? input.description.trim() : null,
      input.category ? input.category.trim() : null,
      input.date ?? null,
      effectiveType,
      effectiveMethod,
      input.id,
    ],
  });
  revalidatePath("/");
  revalidatePath("/insights");
  revalidatePath("/notificacoes");
}

export async function saveEditedMovementAction(input: {
  sourceKind: "transaction" | "daily_override";
  transactionId?: string;
  originalDate: string;
  targetDate: string;
  targetType: "expense_fixed" | "expense_daily" | "income";
  dailyMode?: "add" | "set";
  amount: number;
  description?: string | null;
  category?: string | null;
  paymentMethod?: "cash" | "credit_card";
}) {
  await ensureSchema();
  const cleanAmount = Number(Math.max(0, input.amount).toFixed(2));
  const rawSettings = await db.select().from(settings);
  const settingsMap = new Map(rawSettings.map((s) => [s.key, s.value]));
  const defaultDailyTarget = Number(
    settingsMap.get("daily_spending_target") ?? "50.00"
  );

  if (input.sourceKind === "transaction" && input.transactionId) {
    if (input.targetType === "expense_daily") {
      // Converting an existing transaction (Saída/Entrada) into Diário
      await db
        .delete(transactions)
        .where(eq(transactions.id, input.transactionId));

      const existingOv = await db
        .select()
        .from(dailyOverrides)
        .where(eq(dailyOverrides.date, input.targetDate))
        .limit(1);

      const currentBase = existingOv[0]
        ? existingOv[0].amount
        : defaultDailyTarget;

      const nextDaily =
        input.dailyMode === "set"
          ? cleanAmount
          : Number((currentBase + cleanAmount).toFixed(2));

      const nextNote = input.description
        ? existingOv[0]?.note
          ? `${existingOv[0].note} | ${input.description}`
          : input.description
        : existingOv[0]?.note ?? null;

      await client.execute({
        sql: `INSERT OR REPLACE INTO daily_overrides (date, amount, note, is_reconciled) VALUES (?, ?, ?, 1)`,
        args: [input.targetDate, nextDaily, nextNote],
      });
    } else {
      // Updating transaction (including switching between Saída and Entrada)
      await client.execute({
        sql: `UPDATE transactions
              SET amount = ?,
                  date = ?,
                  type = ?,
                  description = ?,
                  category = ?,
                  payment_method = ?
              WHERE id = ?`,
        args: [
          cleanAmount,
          input.targetDate,
          input.targetType,
          input.description || null,
          input.category || null,
          input.targetType === "income"
            ? "cash"
            : input.paymentMethod || "cash",
          input.transactionId,
        ],
      });
    }
  } else if (input.sourceKind === "daily_override") {
    if (input.targetType === "expense_daily") {
      // Updating Diário directly
      await client.execute({
        sql: `INSERT OR REPLACE INTO daily_overrides (date, amount, note, is_reconciled) VALUES (?, ?, ?, 1)`,
        args: [input.targetDate, cleanAmount, input.description || null],
      });
    } else {
      // Converting Diário into Saída or Entrada: zero the daily override on originalDate and create the transaction
      await client.execute({
        sql: `INSERT OR REPLACE INTO daily_overrides (date, amount, note, is_reconciled) VALUES (?, 0, NULL, 1)`,
        args: [input.originalDate],
      });

      await createRealTransactionAction({
        date: input.targetDate,
        type: input.targetType,
        amount: cleanAmount,
        description: input.description || undefined,
        category: input.category || undefined,
        paymentMethod:
          input.targetType === "income"
            ? "cash"
            : input.paymentMethod || "cash",
        installments: 1,
        isSimulation: false,
      });
    }
  }

  revalidatePath("/");
  revalidatePath("/insights");
  revalidatePath("/notificacoes");
}

export async function upsertDailyOverrideAction(date: string, amount: number, note?: string) {
  await client.execute({
    sql: `INSERT OR REPLACE INTO daily_overrides (date, amount, note, is_reconciled) VALUES (?, ?, ?, 1)`,
    args: [date, amount, note ?? null],
  });
  revalidatePath("/");
  revalidatePath("/insights");
}

export async function removeDailyOverrideAction(date: string) {
  await db.delete(dailyOverrides).where(eq(dailyOverrides.date, date));
  revalidatePath("/");
  revalidatePath("/insights");
}

export async function commitStagedChangesAction(input: {
  stagedTransactions: TransactionRecord[];
  stagedOverrides: DailyOverrideRecord[];
  stagedDeletedTxIds: string[];
}) {
  await ensureSchema();
  const now = new Date().toISOString();

  for (const id of input.stagedDeletedTxIds) {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  for (const ov of input.stagedOverrides) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO daily_overrides (date, amount, note, is_reconciled) VALUES (?, ?, ?, 1)`,
      args: [ov.date, ov.amount, ov.note ?? null],
    });
  }

  for (const tx of input.stagedTransactions) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO transactions (
        id, date, type, amount, description, category, payment_method, purchase_date,
        is_simulation, is_reconciled, installment_current, installment_total,
        installment_group_id, recurring_rule_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)`,
      args: [
        tx.id,
        tx.date,
        tx.type,
        tx.amount,
        tx.description ?? null,
        tx.category ?? null,
        tx.paymentMethod ?? "cash",
        tx.purchaseDate ?? tx.date,
        tx.installmentCurrent ?? null,
        tx.installmentTotal ?? null,
        tx.installmentGroupId ?? null,
        tx.recurringRuleId ?? null,
        now,
      ],
    });
  }

  revalidatePath("/");
  revalidatePath("/insights");
}

export async function updateSettingsAction(newSettings: Partial<CashflowSettings>) {
  const entries: [string, string][] = [];
  if (newSettings.initialBalance !== undefined)
    entries.push(["initial_balance", String(newSettings.initialBalance)]);
  if (newSettings.initialBalanceDate !== undefined)
    entries.push(["initial_balance_date", newSettings.initialBalanceDate]);
  if (newSettings.dailySpendingTarget !== undefined)
    entries.push(["daily_spending_target", String(newSettings.dailySpendingTarget)]);
  if (newSettings.creditCardClosingDay !== undefined)
    entries.push(["credit_card_closing_day", String(newSettings.creditCardClosingDay)]);
  if (newSettings.creditCardDueDay !== undefined)
    entries.push(["credit_card_due_day", String(newSettings.creditCardDueDay)]);

  for (const [k, v] of entries) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      args: [k, v],
    });
  }

  revalidatePath("/");
  revalidatePath("/insights");
}

export async function upsertRecurringRuleAction(rule: {
  id?: string;
  title: string;
  amount: number;
  type: "income" | "expense_fixed";
  category?: string;
  dayOfMonth: number;
}) {
  const id = rule.id || `rec_${crypto.randomUUID()}`;
  await client.execute({
    sql: `INSERT OR REPLACE INTO recurring_rules (id, title, amount, type, category, day_of_month, payment_method, is_active)
          VALUES (?, ?, ?, ?, ?, ?, 'cash', 1)`,
    args: [id, rule.title, rule.amount, rule.type, rule.category ?? "Outros", rule.dayOfMonth],
  });
  revalidatePath("/");
  revalidatePath("/insights");
  return id;
}

export async function deleteRecurringRuleAction(id: string) {
  await db.delete(recurringRules).where(eq(recurringRules.id, id));
  revalidatePath("/");
  revalidatePath("/insights");
}

export async function setRecurringOccurrenceStatusAction(input: {
  ruleId: string;
  yearMonth: string;
  status: "confirmed" | "skipped" | "modified";
  modifiedAmount?: number;
}) {
  const id = `${input.ruleId}_${input.yearMonth}`;
  await client.execute({
    sql: `INSERT OR REPLACE INTO recurring_occurrences (id, rule_id, year_month, status, modified_amount)
          VALUES (?, ?, ?, ?, ?)`,
    args: [id, input.ruleId, input.yearMonth, input.status, input.modifiedAmount ?? null],
  });
  revalidatePath("/");
  revalidatePath("/insights");
}

export async function loginWithPasswordAction(password: string): Promise<{
  ok: boolean;
  expiresAt?: number;
  error?: string;
}> {
  if (!verifyPassword(password)) {
    return { ok: false, error: "Senha incorreta." };
  }

  const { token, expiresAt } = createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: TWENTY_HOURS_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });

  return { ok: true, expiresAt };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export interface MobileNotificationRecord {
  id: string;
  fingerprint: string;
  appPackage: string | null;
  appName: string | null;
  title: string | null;
  message: string;
  originalTimestamp: string;
  eventDate: string;
  detectedType: "outgoing" | "incoming" | "ignored";
  parsedAmount: number | null;
  parsedMerchant: string | null;
  parsedPaymentMethod: string | null;
  status: "pending" | "processed" | "ignored";
  transactionId: string | null;
  createdAt: string;
}

export type NotificationApprovalTarget =
  | "daily_add"
  | "daily_set"
  | "expense_fixed"
  | "income";

export interface ApproveNotificationInput {
  id: string;
  amount: number;
  date: string; // 'YYYY-MM-DD'
  targetMode: NotificationApprovalTarget;
  description?: string;
  category?: string;
  paymentMethod?: "cash" | "credit_card";
  installments?: number;
}

export async function fetchMobileNotificationsAction(): Promise<
  MobileNotificationRecord[]
> {
  await ensureSchema();
  const rows = await db
    .select()
    .from(mobileNotifications)
    .orderBy(desc(mobileNotifications.originalTimestamp))
    .limit(120);

  return rows.map((r) => ({
    id: r.id,
    fingerprint: r.fingerprint,
    appPackage: r.appPackage,
    appName: r.appName,
    title: r.title,
    message: r.message,
    originalTimestamp: r.originalTimestamp,
    eventDate: r.eventDate,
    detectedType: (r.detectedType as MobileNotificationRecord["detectedType"]) || "outgoing",
    parsedAmount: r.parsedAmount,
    parsedMerchant: r.parsedMerchant,
    parsedPaymentMethod: r.parsedPaymentMethod,
    status: (r.status as MobileNotificationRecord["status"]) || "pending",
    transactionId: r.transactionId,
    createdAt: r.createdAt,
  }));
}

async function processSingleNotificationApproval(
  input: ApproveNotificationInput,
  settingsMap: Map<string, string>
): Promise<{ ok: boolean; skipped?: boolean; transactionId?: string }> {
  const existingNotif = await db
    .select()
    .from(mobileNotifications)
    .where(eq(mobileNotifications.id, input.id))
    .limit(1);

  if (!existingNotif[0] || existingNotif[0].status === "processed") {
    return { ok: true, skipped: true };
  }

  const cleanAmount = Number(Math.max(0, input.amount).toFixed(2));
  if (cleanAmount <= 0) {
    throw new Error("O valor para aprovação deve ser maior que zero.");
  }

  const defaultDailyTarget = Number(
    settingsMap.get("daily_spending_target") ?? "50.00"
  );
  const closingDay = Number(
    settingsMap.get("credit_card_closing_day") ?? "20"
  );
  const dueDay = Number(settingsMap.get("credit_card_due_day") ?? "27");

  let linkedTxId = `daily_${input.date}`;

  if (input.targetMode === "daily_add" || input.targetMode === "daily_set") {
    // RN-03 & RN-04: Every Diário entry is an individual transaction with its own properties
    const now = new Date().toISOString();
    const txId = `tx_${crypto.randomUUID()}`;
    linkedTxId = txId;
    await db.insert(transactions).values({
      id: txId,
      date: input.date,
      type: "expense_daily",
      amount: cleanAmount,
      description: input.description || null,
      category: input.category || null,
      paymentMethod: "cash",
      purchaseDate: input.date,
      isSimulation: 0,
      isReconciled: 1,
      installmentCurrent: null,
      installmentTotal: null,
      installmentGroupId: null,
      recurringRuleId: null,
      createdAt: now,
    });
  } else {
    // 'expense_fixed' (Saída) or 'income' (Entrada)
    const now = new Date().toISOString();
    const effectivePaymentMethod =
      input.targetMode === "income"
        ? "cash"
        : input.paymentMethod ?? "cash";
    const installmentsCount =
      effectivePaymentMethod === "credit_card"
        ? Math.max(1, input.installments ?? 1)
        : 1;

    const targetDates =
      effectivePaymentMethod === "credit_card"
        ? calculateCreditCardInstallmentDates(
            input.date,
            installmentsCount,
            closingDay,
            dueDay
          )
        : [input.date];

    const perInstallmentAmount = Number(
      (cleanAmount / installmentsCount).toFixed(2)
    );
    const groupId =
      installmentsCount > 1 ? `grp_${crypto.randomUUID()}` : null;

    for (let idx = 0; idx < targetDates.length; idx++) {
      const txId = `tx_${crypto.randomUUID()}`;
      if (idx === 0) linkedTxId = txId;
      await db.insert(transactions).values({
        id: txId,
        date: targetDates[idx],
        type: input.targetMode,
        amount: perInstallmentAmount,
        description: input.description || null,
        category: input.category || null,
        paymentMethod: effectivePaymentMethod,
        purchaseDate: input.date,
        isSimulation: 0,
        isReconciled: 1,
        installmentCurrent: installmentsCount > 1 ? idx + 1 : null,
        installmentTotal: installmentsCount > 1 ? installmentsCount : null,
        installmentGroupId: groupId,
        recurringRuleId: null,
        createdAt: now,
      });
    }
  }

  await client.execute({
    sql: `UPDATE mobile_notifications
          SET status = 'processed',
              transaction_id = ?,
              parsed_amount = ?,
              event_date = ?
          WHERE id = ?`,
    args: [linkedTxId, cleanAmount, input.date, input.id],
  });

  return { ok: true, transactionId: linkedTxId };
}

export async function approveNotificationAction(
  input: ApproveNotificationInput
) {
  await ensureSchema();
  const rawSettings = await db.select().from(settings);
  const settingsMap = new Map(rawSettings.map((s) => [s.key, s.value]));

  const res = await processSingleNotificationApproval(input, settingsMap);

  revalidatePath("/");
  revalidatePath("/insights");
  revalidatePath("/notificacoes");
  return res;
}

export async function approveAllNotificationsAction(
  inputs: ApproveNotificationInput[]
) {
  await ensureSchema();
  const rawSettings = await db.select().from(settings);
  const settingsMap = new Map(rawSettings.map((s) => [s.key, s.value]));

  let approvedCount = 0;
  for (const item of inputs) {
    const res = await processSingleNotificationApproval(item, settingsMap);
    if (res.ok && !res.skipped) {
      approvedCount++;
    }
  }

  revalidatePath("/");
  revalidatePath("/insights");
  revalidatePath("/notificacoes");
  return { ok: true, approvedCount };
}

export async function rejectNotificationAction(id: string) {
  await ensureSchema();
  await client.execute({
    sql: `UPDATE mobile_notifications SET status = 'ignored' WHERE id = ?`,
    args: [id],
  });
  revalidatePath("/");
  revalidatePath("/notificacoes");
  return { ok: true };
}

export async function rejectAllNotificationsAction(ids: string[]) {
  await ensureSchema();
  for (const id of ids) {
    await client.execute({
      sql: `UPDATE mobile_notifications SET status = 'ignored' WHERE id = ?`,
      args: [id],
    });
  }
  revalidatePath("/");
  revalidatePath("/notificacoes");
  return { ok: true, rejectedCount: ids.length };
}

export async function reopenNotificationAction(id: string) {
  await ensureSchema();
  await client.execute({
    sql: `UPDATE mobile_notifications SET status = 'pending' WHERE id = ?`,
    args: [id],
  });
  revalidatePath("/");
  revalidatePath("/notificacoes");
  return { ok: true };
}

export async function revertApprovedNotificationAction(id: string) {
  await ensureSchema();
  const rows = await db
    .select()
    .from(mobileNotifications)
    .where(eq(mobileNotifications.id, id))
    .limit(1);

  const notif = rows[0];
  if (!notif) {
    return { ok: false, error: "Notificação não encontrada." };
  }

  if (notif.status === "processed" && notif.transactionId) {
    if (notif.transactionId.startsWith("tx_")) {
      await db
        .delete(transactions)
        .where(eq(transactions.id, notif.transactionId));
    } else if (
      notif.transactionId.startsWith("daily_") &&
      notif.parsedAmount &&
      notif.parsedAmount > 0
    ) {
      const targetDate = notif.transactionId.replace("daily_", "");
      const existingOv = await db
        .select()
        .from(dailyOverrides)
        .where(eq(dailyOverrides.date, targetDate))
        .limit(1);

      if (existingOv[0]) {
        const revertedAmount = Math.max(
          0,
          Number((existingOv[0].amount - notif.parsedAmount).toFixed(2))
        );
        await client.execute({
          sql: `UPDATE daily_overrides SET amount = ? WHERE date = ?`,
          args: [revertedAmount, targetDate],
        });
      }
    }
  }

  await client.execute({
    sql: `UPDATE mobile_notifications SET status = 'pending', transaction_id = NULL WHERE id = ?`,
    args: [id],
  });

  revalidatePath("/");
  revalidatePath("/insights");
  revalidatePath("/notificacoes");
  return { ok: true };
}
