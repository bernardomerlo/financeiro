import { describe, expect, it } from "vitest";
import {
  formatDurationHoursMinutes,
  formatExerciseTypeLabel,
  normalizeHealthSyncBatch,
} from "./health-sync";

describe("health-sync parser & contract compatibility (automacao_samsung_health)", () => {
  it("normalizes SyncBatchPayload matching Kotlin SyncModels.kt contract", () => {
    const payload = {
      device: "android-samsung-health",
      syncedAt: "2026-11-27T11:00:00Z",
      sleeps: [
        {
          uid: "sleep-uid-001",
          startTime: "2026-11-26T23:30:00Z",
          endTime: "2026-11-27T07:15:00Z",
          durationMinutes: 465,
          sleepScore: 84,
        },
      ],
      exercises: [
        {
          uid: "ex-uid-001",
          exerciseType: "RUNNING",
          startTime: "2026-11-27T07:40:00Z",
          endTime: "2026-11-27T08:25:00Z",
          durationMinutes: 45,
          caloriesKcal: 420.5,
          distanceMeters: 5200.0,
        },
      ],
    };

    const batch = normalizeHealthSyncBatch(payload);
    expect(batch.device).toBe("android-samsung-health");
    expect(batch.sleeps).toHaveLength(1);
    expect(batch.sleeps[0]).toEqual({
      uid: "sleep-uid-001",
      date: "2026-11-27",
      startTime: "2026-11-26T23:30:00.000Z",
      endTime: "2026-11-27T07:15:00.000Z",
      durationMinutes: 465,
      sleepScore: 84,
    });

    expect(batch.exercises).toHaveLength(1);
    expect(batch.exercises[0]).toEqual({
      uid: "ex-uid-001",
      date: "2026-11-27",
      exerciseType: "RUNNING",
      startTime: "2026-11-27T07:40:00.000Z",
      endTime: "2026-11-27T08:25:00.000Z",
      durationMinutes: 45,
      caloriesKcal: 420.5,
      distanceMeters: 5200,
    });
  });

  it("handles nullable sleepScore, caloriesKcal, and distanceMeters from Kotlin payload", () => {
    const batch = normalizeHealthSyncBatch({
      device: "android-samsung-health",
      syncedAt: "2026-11-28T10:00:00Z",
      sleeps: [
        {
          uid: "sleep-no-score",
          startTime: "2026-11-28T02:00:00Z",
          endTime: "2026-11-28T10:00:00Z",
          durationMinutes: 480,
          sleepScore: null,
        },
      ],
      exercises: [
        {
          uid: "ex-weight",
          exerciseType: "WEIGHT_MACHINE",
          startTime: "2026-11-28T11:00:00Z",
          endTime: "2026-11-28T12:00:00Z",
          durationMinutes: 60,
          caloriesKcal: null,
          distanceMeters: null,
        },
      ],
    });

    expect(batch.sleeps[0].sleepScore).toBeNull();
    expect(batch.exercises[0].caloriesKcal).toBeNull();
    expect(batch.exercises[0].distanceMeters).toBeNull();
    expect(formatExerciseTypeLabel("WEIGHT_MACHINE")).toBe("Musculação");
    expect(formatDurationHoursMinutes(465)).toBe("7h 45m");
  });
});
