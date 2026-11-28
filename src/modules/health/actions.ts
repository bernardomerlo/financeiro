"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { client, db, ensureSchema } from "@/db";
import { healthExercises, healthSleeps, healthSyncLogs } from "./schema";

export interface HealthSleepRecord {
  uid: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  sleepScore: number | null;
  device: string;
  notes: string | null;
  isManualOverride: boolean;
  syncedAt: string;
  createdAt: string;
}

export interface HealthExerciseRecord {
  uid: string;
  date: string;
  exerciseType: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  caloriesKcal: number | null;
  distanceMeters: number | null;
  device: string;
  notes: string | null;
  isManualOverride: boolean;
  syncedAt: string;
  createdAt: string;
}

export interface HealthSyncLogRecord {
  id: string;
  device: string;
  syncedAt: string;
  sleepsReceived: number;
  sleepsUpserted: number;
  exercisesReceived: number;
  exercisesUpserted: number;
  createdAt: string;
}

export interface HealthDashboardData {
  sleeps: HealthSleepRecord[];
  exercises: HealthExerciseRecord[];
  syncLogs: HealthSyncLogRecord[];
}

export async function fetchHealthDashboardDataAction(): Promise<HealthDashboardData> {
  await ensureSchema();

  const [rawSleeps, rawExercises, rawLogs] = await Promise.all([
    db
      .select()
      .from(healthSleeps)
      .orderBy(desc(healthSleeps.endTime))
      .limit(120),
    db
      .select()
      .from(healthExercises)
      .orderBy(desc(healthExercises.startTime))
      .limit(120),
    db
      .select()
      .from(healthSyncLogs)
      .orderBy(desc(healthSyncLogs.createdAt))
      .limit(25),
  ]);

  return {
    sleeps: rawSleeps.map((s) => ({
      uid: s.uid,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      durationMinutes: s.durationMinutes,
      sleepScore: s.sleepScore,
      device: s.device,
      notes: s.notes ?? null,
      isManualOverride: Boolean(s.isManualOverride),
      syncedAt: s.syncedAt,
      createdAt: s.createdAt,
    })),
    exercises: rawExercises.map((e) => ({
      uid: e.uid,
      date: e.date,
      exerciseType: e.exerciseType,
      startTime: e.startTime,
      endTime: e.endTime,
      durationMinutes: e.durationMinutes,
      caloriesKcal: e.caloriesKcal,
      distanceMeters: e.distanceMeters,
      device: e.device,
      notes: e.notes ?? null,
      isManualOverride: Boolean(e.isManualOverride),
      syncedAt: e.syncedAt,
      createdAt: e.createdAt,
    })),
    syncLogs: rawLogs.map((l) => ({
      id: l.id,
      device: l.device,
      syncedAt: l.syncedAt,
      sleepsReceived: l.sleepsReceived,
      sleepsUpserted: l.sleepsUpserted,
      exercisesReceived: l.exercisesReceived,
      exercisesUpserted: l.exercisesUpserted,
      createdAt: l.createdAt,
    })),
  };
}

export async function updateHealthSleepManualAction(input: {
  uid: string;
  durationMinutes: number;
  sleepScore: number | null;
  notes?: string | null;
}) {
  await ensureSchema();
  const cleanMinutes = Math.max(0, Math.round(input.durationMinutes));
  const cleanScore =
    input.sleepScore != null && Number.isFinite(input.sleepScore)
      ? Math.min(100, Math.max(0, Math.round(input.sleepScore)))
      : null;

  await client.execute({
    sql: `UPDATE health_sleeps
          SET duration_minutes = ?, sleep_score = ?, notes = ?, is_manual_override = 1
          WHERE uid = ?`,
    args: [cleanMinutes, cleanScore, input.notes?.trim() || null, input.uid],
  });

  revalidatePath("/");
  revalidatePath("/saude");
  revalidatePath("/bujo");
  return { ok: true };
}

export async function updateHealthExerciseManualAction(input: {
  uid: string;
  exerciseType: string;
  durationMinutes: number;
  caloriesKcal?: number | null;
  notes?: string | null;
}) {
  await ensureSchema();
  const cleanMinutes = Math.max(0, Math.round(input.durationMinutes));
  const cleanType = input.exerciseType.trim().toUpperCase() || "OTHER";
  const cleanCalories =
    input.caloriesKcal != null && Number.isFinite(input.caloriesKcal)
      ? Number(Math.max(0, input.caloriesKcal).toFixed(1))
      : null;

  await client.execute({
    sql: `UPDATE health_exercises
          SET exercise_type = ?, duration_minutes = ?, calories_kcal = ?, notes = ?, is_manual_override = 1
          WHERE uid = ?`,
    args: [
      cleanType,
      cleanMinutes,
      cleanCalories,
      input.notes?.trim() || null,
      input.uid,
    ],
  });

  revalidatePath("/");
  revalidatePath("/saude");
  revalidatePath("/bujo");
  return { ok: true };
}

export async function deleteHealthSleepAction(uid: string) {
  await ensureSchema();
  await db.delete(healthSleeps).where(eq(healthSleeps.uid, uid));
  revalidatePath("/");
  revalidatePath("/saude");
  revalidatePath("/bujo");
  return { ok: true };
}

export async function deleteHealthExerciseAction(uid: string) {
  await ensureSchema();
  await db.delete(healthExercises).where(eq(healthExercises.uid, uid));
  revalidatePath("/");
  revalidatePath("/saude");
  revalidatePath("/bujo");
  return { ok: true };
}
