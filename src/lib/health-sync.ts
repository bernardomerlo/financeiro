export interface RawSleepPayload {
  uid?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  durationMinutes?: unknown;
  sleepScore?: unknown;
}

export interface RawExercisePayload {
  uid?: unknown;
  exerciseType?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  durationMinutes?: unknown;
  caloriesKcal?: unknown;
  distanceMeters?: unknown;
}

export interface RawSyncBatchPayload {
  device?: unknown;
  syncedAt?: unknown;
  sleeps?: unknown;
  exercises?: unknown;
}

export interface NormalizedSleepRecord {
  uid: string;
  date: string; // 'YYYY-MM-DD' in America/Sao_Paulo (wake-up date)
  startTime: string;
  endTime: string;
  durationMinutes: number;
  sleepScore: number | null;
}

export interface NormalizedExerciseRecord {
  uid: string;
  date: string; // 'YYYY-MM-DD' in America/Sao_Paulo (start date)
  exerciseType: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  caloriesKcal: number | null;
  distanceMeters: number | null;
}

export interface NormalizedHealthSyncBatch {
  device: string;
  syncedAt: string;
  sleeps: NormalizedSleepRecord[];
  exercises: NormalizedExerciseRecord[];
}

export function isoToBrazilDate(isoStr: string, fallbackNow = new Date()): string {
  const parsed = new Date(isoStr);
  const validDate = Number.isNaN(parsed.getTime()) ? fallbackNow : parsed;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(validDate);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback to UTC-3 offset
  }
  const brTime = new Date(validDate.getTime() - 3 * 60 * 60 * 1000);
  return brTime.toISOString().slice(0, 10);
}

export function normalizeIsoTimestamp(raw: unknown, fallbackNow = new Date()): string {
  if (typeof raw === "string" && raw.trim().length > 0) {
    const parsed = new Date(raw.trim());
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw < 1e11 ? raw * 1000 : raw;
    const parsed = new Date(ms);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallbackNow.toISOString();
}

function computeDurationMinutes(
  rawDuration: unknown,
  startIso: string,
  endIso: string
): number {
  if (typeof rawDuration === "number" && Number.isFinite(rawDuration)) {
    return Math.max(0, Math.round(rawDuration));
  }
  if (typeof rawDuration === "string" && rawDuration.trim().length > 0) {
    const num = Number(rawDuration);
    if (Number.isFinite(num)) {
      return Math.max(0, Math.round(num));
    }
  }
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
    return Math.round((endMs - startMs) / 60_000);
  }
  return 0;
}

export function normalizeHealthSyncBatch(
  rawBody: unknown,
  fallbackNow = new Date()
): NormalizedHealthSyncBatch {
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    throw new Error(
      "Payload inválido. Envie um objeto JSON com 'device', 'syncedAt', 'sleeps' e 'exercises'."
    );
  }

  const body = rawBody as RawSyncBatchPayload;
  const device =
    typeof body.device === "string" && body.device.trim().length > 0
      ? body.device.trim()
      : "android-samsung-health";

  const syncedAt = normalizeIsoTimestamp(body.syncedAt, fallbackNow);

  if (body.sleeps !== undefined && !Array.isArray(body.sleeps)) {
    throw new Error("O campo 'sleeps' deve ser um array.");
  }
  if (body.exercises !== undefined && !Array.isArray(body.exercises)) {
    throw new Error("O campo 'exercises' deve ser um array.");
  }

  const rawSleeps = (body.sleeps as RawSleepPayload[] | undefined) ?? [];
  const rawExercises = (body.exercises as RawExercisePayload[] | undefined) ?? [];

  const sleeps: NormalizedSleepRecord[] = [];
  for (let i = 0; i < rawSleeps.length; i++) {
    const item = rawSleeps[i];
    if (!item || typeof item !== "object") continue;

    const uid =
      typeof item.uid === "string"
        ? item.uid.trim()
        : typeof item.uid === "number"
          ? String(item.uid)
          : "";
    if (!uid) {
      throw new Error(`sleeps[${i}].uid é obrigatório.`);
    }

    const startTime = normalizeIsoTimestamp(item.startTime, fallbackNow);
    const endTime = normalizeIsoTimestamp(item.endTime ?? item.startTime, fallbackNow);
    const durationMinutes = computeDurationMinutes(
      item.durationMinutes,
      startTime,
      endTime
    );

    let sleepScore: number | null = null;
    if (item.sleepScore !== null && item.sleepScore !== undefined && item.sleepScore !== "") {
      const scoreNum = Number(item.sleepScore);
      if (Number.isFinite(scoreNum) && scoreNum >= 0 && scoreNum <= 100) {
        sleepScore = Math.round(scoreNum);
      }
    }

    sleeps.push({
      uid,
      date: isoToBrazilDate(endTime, fallbackNow),
      startTime,
      endTime,
      durationMinutes,
      sleepScore,
    });
  }

  const exercises: NormalizedExerciseRecord[] = [];
  for (let i = 0; i < rawExercises.length; i++) {
    const item = rawExercises[i];
    if (!item || typeof item !== "object") continue;

    const uid =
      typeof item.uid === "string"
        ? item.uid.trim()
        : typeof item.uid === "number"
          ? String(item.uid)
          : "";
    if (!uid) {
      throw new Error(`exercises[${i}].uid é obrigatório.`);
    }

    const exerciseType =
      typeof item.exerciseType === "string" && item.exerciseType.trim().length > 0
        ? item.exerciseType.trim().toUpperCase()
        : "OTHER";

    const startTime = normalizeIsoTimestamp(item.startTime, fallbackNow);
    const endTime = normalizeIsoTimestamp(item.endTime ?? item.startTime, fallbackNow);
    const durationMinutes = computeDurationMinutes(
      item.durationMinutes,
      startTime,
      endTime
    );

    let caloriesKcal: number | null = null;
    if (
      item.caloriesKcal !== null &&
      item.caloriesKcal !== undefined &&
      item.caloriesKcal !== ""
    ) {
      const calNum = Number(item.caloriesKcal);
      if (Number.isFinite(calNum) && calNum >= 0) {
        caloriesKcal = Number(calNum.toFixed(1));
      }
    }

    let distanceMeters: number | null = null;
    if (
      item.distanceMeters !== null &&
      item.distanceMeters !== undefined &&
      item.distanceMeters !== ""
    ) {
      const distNum = Number(item.distanceMeters);
      if (Number.isFinite(distNum) && distNum >= 0) {
        distanceMeters = Number(distNum.toFixed(1));
      }
    }

    exercises.push({
      uid,
      date: isoToBrazilDate(startTime, fallbackNow),
      exerciseType,
      startTime,
      endTime,
      durationMinutes,
      caloriesKcal,
      distanceMeters,
    });
  }

  return {
    device,
    syncedAt,
    sleeps,
    exercises,
  };
}

export const EXERCISE_TYPE_LABELS: Record<string, string> = {
  RUNNING: "Corrida",
  WALKING: "Caminhada",
  HIKING: "Trilha",
  CYCLING: "Ciclismo",
  INDOOR_CYCLING: "Bicicleta Ergométrica",
  SWIMMING: "Natação",
  WEIGHT_MACHINE: "Musculação",
  STRENGTH_TRAINING: "Treino de Força",
  CIRCUIT_TRAINING: "Treino Funcional / Circuito",
  HIIT: "HIIT",
  YOGA: "Yoga",
  PILATES: "Pilates",
  STRETCHING: "Alongamento",
  TREADMILL: "Esteira",
  ELLIPTICAL: "Elíptico",
  ROWING: "Remo",
  SOCCER: "Futebol",
  TENNIS: "Tênis",
  BASKETBALL: "Basquete",
  VOLLEYBALL: "Vôlei",
  MARTIAL_ARTS: "Artes Marciais",
  BOXING: "Boxe",
  DANCING: "Dança",
  OTHER: "Outro Exercício",
};

export function formatExerciseTypeLabel(exerciseType: string): string {
  const key = (exerciseType || "OTHER").trim().toUpperCase();
  if (EXERCISE_TYPE_LABELS[key]) {
    return EXERCISE_TYPE_LABELS[key];
  }
  return key
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatDurationHoursMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h <= 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
