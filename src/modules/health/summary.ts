import { and, gte, lte } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { healthExercises, healthSleeps } from "./schema";
import { classifyExerciseCategory } from "./health-sync";

export interface HealthDailySummary {
  date: string;
  sleepMinutes: number | null;
  sleepScore: number | null;
  didGym: boolean;
  didCardio: boolean;
  exerciseCount: number;
  exerciseMinutes: number;
  caloriesKcal: number;
  exerciseLabels: string[];
}

export async function getHealthDailySummaryMap(
  startDate: string,
  endDate: string
): Promise<Map<string, HealthDailySummary>> {
  await ensureSchema();

  const [sleeps, exercises] = await Promise.all([
    db
      .select()
      .from(healthSleeps)
      .where(
        and(gte(healthSleeps.date, startDate), lte(healthSleeps.date, endDate))
      ),
    db
      .select()
      .from(healthExercises)
      .where(
        and(
          gte(healthExercises.date, startDate),
          lte(healthExercises.date, endDate)
        )
      ),
  ]);

  const map = new Map<string, HealthDailySummary>();

  const ensureEntry = (date: string): HealthDailySummary => {
    let entry = map.get(date);
    if (!entry) {
      entry = {
        date,
        sleepMinutes: null,
        sleepScore: null,
        didGym: false,
        didCardio: false,
        exerciseCount: 0,
        exerciseMinutes: 0,
        caloriesKcal: 0,
        exerciseLabels: [],
      };
      map.set(date, entry);
    }
    return entry;
  };

  for (const s of sleeps) {
    const entry = ensureEntry(s.date);
    entry.sleepMinutes =
      (entry.sleepMinutes ?? 0) + Math.max(0, s.durationMinutes);
    if (s.sleepScore != null) {
      entry.sleepScore =
        entry.sleepScore != null
          ? Math.max(entry.sleepScore, s.sleepScore)
          : s.sleepScore;
    }
  }

  for (const ex of exercises) {
    const entry = ensureEntry(ex.date);
    const kind = classifyExerciseCategory(ex.exerciseType);
    if (kind === "gym") entry.didGym = true;
    if (kind === "cardio") entry.didCardio = true;
    entry.exerciseCount += 1;
    entry.exerciseMinutes += Math.max(0, ex.durationMinutes);
    entry.caloriesKcal += ex.caloriesKcal ?? 0;
    entry.exerciseLabels.push(ex.exerciseType);
  }

  return map;
}
