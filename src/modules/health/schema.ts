import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const healthSleeps = sqliteTable("health_sleeps", {
  uid: text("uid").primaryKey(),
  date: text("date").notNull(), // 'YYYY-MM-DD' (wake-up date in America/Sao_Paulo)
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  sleepScore: integer("sleep_score"),
  device: text("device").default("android-samsung-health").notNull(),
  notes: text("notes"),
  isManualOverride: integer("is_manual_override").default(0).notNull(),
  syncedAt: text("synced_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const healthExercises = sqliteTable("health_exercises", {
  uid: text("uid").primaryKey(),
  date: text("date").notNull(), // 'YYYY-MM-DD' (exercise start date in America/Sao_Paulo)
  exerciseType: text("exercise_type").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  caloriesKcal: real("calories_kcal"),
  distanceMeters: real("distance_meters"),
  device: text("device").default("android-samsung-health").notNull(),
  notes: text("notes"),
  isManualOverride: integer("is_manual_override").default(0).notNull(),
  syncedAt: text("synced_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const healthSyncLogs = sqliteTable("health_sync_logs", {
  id: text("id").primaryKey(),
  device: text("device").default("android-samsung-health").notNull(),
  syncedAt: text("synced_at").notNull(),
  sleepsReceived: integer("sleeps_received").default(0).notNull(),
  sleepsUpserted: integer("sleeps_upserted").default(0).notNull(),
  exercisesReceived: integer("exercises_received").default(0).notNull(),
  exercisesUpserted: integer("exercises_upserted").default(0).notNull(),
  rawPayload: text("raw_payload"),
  createdAt: text("created_at").notNull(),
});
