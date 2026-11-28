import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const bujoDays = sqliteTable("bujo_days", {
  date: text("date").primaryKey(), // 'YYYY-MM-DD'
  yesterdayNote: text("yesterday_note"), // Explicit snapshot if imported or manually edited
  todayNote: text("today_note").default("").notNull(), // Freeform Markdown ("Hoje:")
  gymOverride: integer("gym_override"), // null = auto from Health, 1 = true, 0 = false
  cardioOverride: integer("cardio_override"), // null = auto from Health, 1 = true, 0 = false
  vitamin: integer("vitamin").default(0).notNull(), // 0 | 1
  readingOverride: integer("reading_override"), // null = auto/manual, 1 = true, 0 = false
  sleepMinutesOverride: integer("sleep_minutes_override"), // optional manual fallback
  sleepScoreOverride: integer("sleep_score_override"), // optional manual fallback
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const bujoMonths = sqliteTable("bujo_months", {
  yearMonth: text("year_month").primaryKey(), // 'YYYY-MM'
  considerationsMarkdown: text("considerations_markdown").default("").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const bujoTasks = sqliteTable("bujo_tasks", {
  id: text("id").primaryKey(),
  date: text("date"), // 'YYYY-MM-DD' (nullable for annual goals without specific day)
  year: integer("year").notNull(), // e.g., 2026
  month: integer("month"), // 1..12 (for monthly commitments or dated tasks)
  parentId: text("parent_id"), // For subtasks under a task or date group
  title: text("title").notNull(),
  url: text("url"),
  status: text("status").default("todo").notNull(), // 'todo' | 'done' | 'cancelled'
  source: text("source").default("daily").notNull(), // 'daily' | 'annual_log' | 'goal'
  sortOrder: integer("sort_order").default(0).notNull(),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const bujoEntityLinks = sqliteTable("bujo_entity_links", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(), // 'bujo_day' | 'bujo_month' | 'exercise' | 'note' | 'book'
  sourceId: text("source_id").notNull(),
  targetRaw: text("target_raw").notNull(), // Raw text inside [[...]]
  targetSlug: text("target_slug").notNull(), // Normalized slug for matching
  createdAt: text("created_at").notNull(),
});
