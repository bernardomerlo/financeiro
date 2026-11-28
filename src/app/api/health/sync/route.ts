import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { client, db, ensureSchema } from "@/db";
import { healthExercises, healthSleeps, healthSyncLogs } from "@/db/schema";
import {
  AUTH_COOKIE_NAME,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth";
import { normalizeHealthSyncBatch } from "@/lib/health-sync";

function checkHealthWebhookAuth(request: NextRequest): {
  authorized: boolean;
  reason?: string;
} {
  const configuredWebhookSecret = process.env.WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization")?.trim() || null;

  // ApiClient.kt in automacao_samsung_health sends either:
  // - "Authorization: Bearer <token>"
  // - "Authorization: <token>" (when user enters token without "Bearer " or ":")
  // - "<Custom-Header>: <token>" (e.g. "x-api-key: <token>")
  let headerToken: string | null = null;
  if (authHeader) {
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      headerToken = authHeader.slice(7).trim();
    } else {
      headerToken = authHeader;
    }
  }

  const providedSecret =
    headerToken ||
    request.headers.get("x-api-key")?.trim() ||
    request.headers.get("x-webhook-secret")?.trim() ||
    request.nextUrl.searchParams.get("token")?.trim() ||
    request.nextUrl.searchParams.get("key")?.trim() ||
    null;

  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (sessionCookie && verifySessionToken(sessionCookie)) {
    return { authorized: true };
  }

  if (providedSecret) {
    const isValid =
      (configuredWebhookSecret &&
        providedSecret === configuredWebhookSecret.trim()) ||
      verifyPassword(providedSecret);
    if (!isValid) {
      return {
        authorized: false,
        reason: "Chave de API / token de autorização inválido.",
      };
    }
    return { authorized: true };
  }

  if (configuredWebhookSecret && configuredWebhookSecret.trim().length > 0) {
    return {
      authorized: false,
      reason:
        "Token obrigatório. Configure o Header de autorização no app HealthSync (ex.: 'Bearer <token>' ou 'x-api-key: <token>').",
    };
  }

  return { authorized: true };
}

/**
 * POST /api/health/sync
 * Compatible with https://github.com/bernardomerlo/automacao_samsung_health (SyncBatchPayload).
 * Persists sleep and exercise records idempotently by Samsung Health `uid`.
 */
export async function POST(request: NextRequest) {
  const auth = checkHealthWebhookAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { ok: false, error: auth.reason || "Não autorizado." },
      { status: 401 }
    );
  }

  try {
    await ensureSchema();

    const rawText = await request.text();
    if (!rawText.trim()) {
      return NextResponse.json(
        { ok: false, error: "Corpo da requisição vazio." },
        { status: 400 }
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON malformado." },
        { status: 400 }
      );
    }

    const batch = normalizeHealthSyncBatch(parsedJson);
    const nowIso = new Date().toISOString();

    let sleepsUpserted = 0;
    for (const sleep of batch.sleeps) {
      await client.execute({
        sql: `INSERT INTO health_sleeps (
                uid, date, start_time, end_time, duration_minutes, sleep_score, device, synced_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(uid) DO UPDATE SET
                date = excluded.date,
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                duration_minutes = excluded.duration_minutes,
                sleep_score = COALESCE(excluded.sleep_score, health_sleeps.sleep_score),
                device = excluded.device,
                synced_at = excluded.synced_at`,
        args: [
          sleep.uid,
          sleep.date,
          sleep.startTime,
          sleep.endTime,
          sleep.durationMinutes,
          sleep.sleepScore,
          batch.device,
          batch.syncedAt,
          nowIso,
        ],
      });
      sleepsUpserted++;
    }

    let exercisesUpserted = 0;
    for (const ex of batch.exercises) {
      await client.execute({
        sql: `INSERT INTO health_exercises (
                uid, date, exercise_type, start_time, end_time, duration_minutes,
                calories_kcal, distance_meters, device, synced_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(uid) DO UPDATE SET
                date = excluded.date,
                exercise_type = excluded.exercise_type,
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                duration_minutes = excluded.duration_minutes,
                calories_kcal = COALESCE(excluded.calories_kcal, health_exercises.calories_kcal),
                distance_meters = COALESCE(excluded.distance_meters, health_exercises.distance_meters),
                device = excluded.device,
                synced_at = excluded.synced_at`,
        args: [
          ex.uid,
          ex.date,
          ex.exerciseType,
          ex.startTime,
          ex.endTime,
          ex.durationMinutes,
          ex.caloriesKcal,
          ex.distanceMeters,
          batch.device,
          batch.syncedAt,
          nowIso,
        ],
      });
      exercisesUpserted++;
    }

    const logId = `hsync_${crypto.randomUUID()}`;
    await client.execute({
      sql: `INSERT INTO health_sync_logs (
              id, device, synced_at, sleeps_received, sleeps_upserted,
              exercises_received, exercises_upserted, raw_payload, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        logId,
        batch.device,
        batch.syncedAt,
        batch.sleeps.length,
        sleepsUpserted,
        batch.exercises.length,
        exercisesUpserted,
        rawText.slice(0, 10000),
        nowIso,
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        syncId: logId,
        device: batch.device,
        syncedAt: batch.syncedAt,
        summary: {
          sleepsReceived: batch.sleeps.length,
          sleepsUpserted,
          exercisesReceived: batch.exercises.length,
          exercisesUpserted,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/health/sync] Error:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro ao processar lote do Samsung Health.",
      },
      { status: 400 }
    );
  }
}

/**
 * GET /api/health/sync
 * Lists stored sleep records, exercise records, and recent sync logs.
 */
export async function GET(request: NextRequest) {
  const auth = checkHealthWebhookAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { ok: false, error: auth.reason || "Não autorizado." },
      { status: 401 }
    );
  }

  try {
    await ensureSchema();
    const sp = request.nextUrl.searchParams;
    const dateFilter = sp.get("date");
    const limitParam = Math.min(
      200,
      Math.max(1, Number(sp.get("limit") || "60") || 60)
    );

    const [sleeps, exercises, logs] = await Promise.all([
      dateFilter
        ? db
            .select()
            .from(healthSleeps)
            .where(eq(healthSleeps.date, dateFilter))
            .orderBy(desc(healthSleeps.endTime))
            .limit(limitParam)
        : db
            .select()
            .from(healthSleeps)
            .orderBy(desc(healthSleeps.endTime))
            .limit(limitParam),
      dateFilter
        ? db
            .select()
            .from(healthExercises)
            .where(eq(healthExercises.date, dateFilter))
            .orderBy(desc(healthExercises.startTime))
            .limit(limitParam)
        : db
            .select()
            .from(healthExercises)
            .orderBy(desc(healthExercises.startTime))
            .limit(limitParam),
      db
        .select()
        .from(healthSyncLogs)
        .orderBy(desc(healthSyncLogs.createdAt))
        .limit(20),
    ]);

    return NextResponse.json({
      ok: true,
      sleeps,
      exercises,
      logs,
    });
  } catch (err) {
    console.error("[GET /api/health/sync] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro ao consultar dados do Samsung Health." },
      { status: 500 }
    );
  }
}
