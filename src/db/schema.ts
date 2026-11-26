import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  type: text("type").notNull(), // 'income' | 'expense_fixed' | 'expense_daily'
  amount: real("amount").notNull(),
  description: text("description"),
  category: text("category"),
  paymentMethod: text("payment_method").default("cash").notNull(), // 'cash' | 'credit_card'
  purchaseDate: text("purchase_date"),
  isSimulation: integer("is_simulation").default(0).notNull(),
  isReconciled: integer("is_reconciled").default(1).notNull(),
  installmentCurrent: integer("installment_current"),
  installmentTotal: integer("installment_total"),
  installmentGroupId: text("installment_group_id"),
  recurringRuleId: text("recurring_rule_id"),
  createdAt: text("created_at").notNull(),
});

export const dailyOverrides = sqliteTable("daily_overrides", {
  date: text("date").primaryKey(),
  amount: real("amount").notNull(),
  note: text("note"),
  isReconciled: integer("is_reconciled").default(1).notNull(),
});

export const recurringRules = sqliteTable("recurring_rules", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  amount: real("amount").notNull(),
  type: text("type").notNull(), // 'income' | 'expense_fixed'
  category: text("category"),
  dayOfMonth: integer("day_of_month").notNull(),
  paymentMethod: text("payment_method").default("cash").notNull(), // 'cash' | 'credit_card'
  isActive: integer("is_active").default(1).notNull(),
});

export const recurringOccurrences = sqliteTable("recurring_occurrences", {
  id: text("id").primaryKey(), // format: `${ruleId}_${yyyy-mm}`
  ruleId: text("rule_id").notNull(),
  yearMonth: text("year_month").notNull(), // 'YYYY-MM'
  status: text("status").notNull(), // 'confirmed' | 'skipped' | 'modified'
  modifiedAmount: real("modified_amount"),
});

export const mobileNotifications = sqliteTable("mobile_notifications", {
  id: text("id").primaryKey(),
  fingerprint: text("fingerprint").notNull().unique(),
  appPackage: text("app_package"),
  appName: text("app_name"),
  title: text("title"),
  message: text("message").notNull(),
  originalTimestamp: text("original_timestamp").notNull(),
  eventDate: text("event_date").notNull(), // 'YYYY-MM-DD'
  detectedType: text("detected_type").notNull(), // 'outgoing' | 'incoming' | 'ignored'
  parsedAmount: real("parsed_amount"),
  parsedMerchant: text("parsed_merchant"),
  parsedPaymentMethod: text("parsed_payment_method"), // 'debit' | 'pix' | 'credit_card' | 'transfer' | 'bill' | 'unknown'
  status: text("status").default("pending").notNull(), // 'pending' | 'processed' | 'ignored'
  transactionId: text("transaction_id"),
  rawPayload: text("raw_payload"),
  createdAt: text("created_at").notNull(),
});
