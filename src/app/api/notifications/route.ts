import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";
import { client, db, ensureSchema } from "@/db";
import { mobileNotifications } from "@/db/schema";
import {
  AUTH_COOKIE_NAME,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth";
import {
  extractRawNotificationsFromBody,
  normalizeSingleNotification,
  type RawNotificationInput,
} from "@/lib/notification-parser";

function checkWebhookAuthorization(request: NextRequest): {
  authorized: boolean;
  reason?: string;
} {
  const configuredWebhookSecret = process.env.WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  const providedSecret =
    bearerToken ||
    request.headers.get("x-api-key") ||
    request.headers.get("x-webhook-secret") ||
    request.nextUrl.searchParams.get("token") ||
    request.nextUrl.searchParams.get("key");

  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (sessionCookie && verifySessionToken(sessionCookie)) {
    return { authorized: true };
  }

  if (providedSecret) {
    const isValid =
      (configuredWebhookSecret && providedSecret === configuredWebhookSecret) ||
      verifyPassword(providedSecret);
    if (!isValid) {
      return {
        authorized: false,
        reason: "Chave de API / token inválido.",
      };
    }
    return { authorized: true };
  }

  // If WEBHOOK_SECRET is explicitly configured in environment, enforce it
  if (configuredWebhookSecret && configuredWebhookSecret.trim().length > 0) {
    return {
      authorized: false,
      reason:
        "Token obrigatório. Envie o header 'x-api-key' ou 'Authorization: Bearer <token>'.",
    };
  }

  return { authorized: true };
}

/**
 * POST /api/notifications
 * Receives single or batch mobile notifications (including offline retry queues).
 * Guarantees idempotency via deterministic SHA-256 fingerprint (UNIQUE constraint).
 * Always returns HTTP 200 on duplicate retries so the mobile queue marks them as delivered.
 */
export async function POST(request: NextRequest) {
  const auth = checkWebhookAuthorization(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { ok: false, error: auth.reason || "Não autorizado." },
      { status: 401 }
    );
  }

  try {
    await ensureSchema();

    const contentType = request.headers.get("content-type");
    const bodyText = await request.text();

    let rawItems: RawNotificationInput[] = [];

    if (bodyText.trim().length > 0) {
      rawItems = extractRawNotificationsFromBody(bodyText, contentType);
    } else {
      // Fallback: check if query parameters contain a notification payload
      const sp = request.nextUrl.searchParams;
      const queryMsg =
        sp.get("message") ||
        sp.get("notification") ||
        sp.get("text") ||
        sp.get("not_text") ||
        sp.get("title") ||
        sp.get("not_title");
      if (queryMsg) {
        rawItems = [
          {
            appPackage:
              sp.get("appPackage") ||
              sp.get("not_app_package") ||
              sp.get("package") ||
              undefined,
            appName:
              sp.get("appName") ||
              sp.get("not_app_name") ||
              sp.get("app") ||
              undefined,
            title: sp.get("title") || sp.get("not_title") || undefined,
            message: queryMsg,
            bigText:
              sp.get("bigText") ||
              sp.get("not_sub_text") ||
              sp.get("not_big_text") ||
              undefined,
            timestamp:
              sp.get("timestamp") || sp.get("not_timestamp") || undefined,
            notificationId:
              sp.get("notificationId") || sp.get("id") || undefined,
          },
        ];
      } else {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Corpo da requisição vazio. Envie um JSON com 'message' ('{notification}'), 'title' ('{not_title}'), 'appName' ('{not_app_name}') e 'timestamp'.",
          },
          { status: 400 }
        );
      }
    }

    if (rawItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Nenhuma notificação encontrada no payload." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    let insertedCount = 0;
    let duplicateCount = 0;
    let ignoredCount = 0;
    let outgoingDetectedCount = 0;

    const results: Array<{
      id: string;
      fingerprint: string;
      duplicate: boolean;
      ignored?: boolean;
      appPackage: string | null;
      appName: string | null;
      title: string | null;
      message: string;
      originalTimestamp: string;
      eventDate: string;
      detectedType: string;
      parsedAmount: number | null;
      parsedMerchant: string | null;
      parsedPaymentMethod: string;
      status: string;
    }> = [];

    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < rawItems.length; i++) {
      try {
        const normalized = normalizeSingleNotification(rawItems[i]);

        // Skip persisting notifications that do not represent a completed transaction
        // (e.g., declined purchases, coupons/promotions, OTP codes, invoice reminders).
        // Still return HTTP 200 so MacroDroid marks the webhook as delivered.
        if (normalized.detectedType === "ignored") {
          ignoredCount++;
          results.push({
            id: `ignored_${normalized.fingerprint}`,
            fingerprint: normalized.fingerprint,
            duplicate: false,
            ignored: true,
            appPackage: normalized.appPackage,
            appName: normalized.appName,
            title: normalized.title,
            message: normalized.message,
            originalTimestamp: normalized.originalTimestamp,
            eventDate: normalized.eventDate,
            detectedType: normalized.detectedType,
            parsedAmount: normalized.parsedAmount,
            parsedMerchant: normalized.parsedMerchant,
            parsedPaymentMethod: normalized.parsedPaymentMethod,
            status: "ignored",
          });
          continue;
        }

        const newId = `notif_${crypto.randomUUID()}`;

        // Atomic idempotent insert: if fingerprint already exists, SQLite ignores the insert
        const insertRes = await client.execute({
          sql: `INSERT OR IGNORE INTO mobile_notifications (
            id,
            fingerprint,
            app_package,
            app_name,
            title,
            message,
            original_timestamp,
            event_date,
            detected_type,
            parsed_amount,
            parsed_merchant,
            parsed_payment_method,
            status,
            transaction_id,
            raw_payload,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`,
          args: [
            newId,
            normalized.fingerprint,
            normalized.appPackage,
            normalized.appName,
            normalized.title,
            normalized.message,
            normalized.originalTimestamp,
            normalized.eventDate,
            normalized.detectedType,
            normalized.parsedAmount,
            normalized.parsedMerchant,
            normalized.parsedPaymentMethod,
            normalized.rawPayload,
            nowIso,
          ],
        });

        const wasInserted = (insertRes.rowsAffected ?? 0) > 0;
        let finalId = newId;
        let finalStatus = "pending";

        if (wasInserted) {
          insertedCount++;
          if (normalized.detectedType === "outgoing") {
            outgoingDetectedCount++;
          }
        } else {
          duplicateCount++;
          const existing = await db
            .select({
              id: mobileNotifications.id,
              status: mobileNotifications.status,
            })
            .from(mobileNotifications)
            .where(eq(mobileNotifications.fingerprint, normalized.fingerprint))
            .limit(1);

          if (existing[0]) {
            finalId = existing[0].id;
            finalStatus = existing[0].status;
          }
        }

        results.push({
          id: finalId,
          fingerprint: normalized.fingerprint,
          duplicate: !wasInserted,
          appPackage: normalized.appPackage,
          appName: normalized.appName,
          title: normalized.title,
          message: normalized.message,
          originalTimestamp: normalized.originalTimestamp,
          eventDate: normalized.eventDate,
          detectedType: normalized.detectedType,
          parsedAmount: normalized.parsedAmount,
          parsedMerchant: normalized.parsedMerchant,
          parsedPaymentMethod: normalized.parsedPaymentMethod,
          status: finalStatus,
        });
      } catch (itemErr) {
        errors.push({
          index: i,
          error:
            itemErr instanceof Error
              ? itemErr.message
              : "Erro ao processar item.",
        });
      }
    }

    if (results.length === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: errors[0].error,
          errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        summary: {
          received: rawItems.length,
          inserted: insertedCount,
          duplicates: duplicateCount,
          ignored: ignoredCount,
          outgoingDetected: outgoingDetectedCount,
          errors: errors.length,
        },
        notifications: results,
        ...(errors.length > 0 ? { errors } : {}),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/notifications] Error:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro interno ao processar notificação.",
      },
      { status: 400 }
    );
  }
}

/**
 * GET /api/notifications
 * Lists notifications stored in the database.
 * Supports filters: ?status=pending|processed|ignored, ?type=outgoing|incoming|ignored, ?date=YYYY-MM-DD, ?limit=50
 */
export async function GET(request: NextRequest) {
  const auth = checkWebhookAuthorization(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { ok: false, error: auth.reason || "Não autorizado." },
      { status: 401 }
    );
  }

  try {
    await ensureSchema();

    const sp = request.nextUrl.searchParams;
    const statusFilter = sp.get("status");
    const typeFilter = sp.get("type");
    const dateFilter = sp.get("date");
    const limitParam = Math.min(
      200,
      Math.max(1, Number(sp.get("limit") || "50") || 50)
    );

    const conditions = [];
    if (statusFilter && statusFilter !== "all") {
      conditions.push(eq(mobileNotifications.status, statusFilter));
    }
    if (typeFilter && typeFilter !== "all") {
      conditions.push(eq(mobileNotifications.detectedType, typeFilter));
    }
    if (dateFilter) {
      conditions.push(eq(mobileNotifications.eventDate, dateFilter));
    }

    const rows =
      conditions.length > 0
        ? await db
            .select()
            .from(mobileNotifications)
            .where(and(...conditions))
            .orderBy(desc(mobileNotifications.originalTimestamp))
            .limit(limitParam)
        : await db
            .select()
            .from(mobileNotifications)
            .orderBy(desc(mobileNotifications.originalTimestamp))
            .limit(limitParam);

    return NextResponse.json({
      ok: true,
      count: rows.length,
      notifications: rows,
    });
  } catch (err) {
    console.error("[GET /api/notifications] Error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro ao buscar notificações.",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Updates status ('pending' | 'processed' | 'ignored') and/or transactionId for one or more notifications.
 */
export async function PATCH(request: NextRequest) {
  const auth = checkWebhookAuthorization(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { ok: false, error: auth.reason || "Não autorizado." },
      { status: 401 }
    );
  }

  try {
    await ensureSchema();
    const body = (await request.json()) as {
      id?: string;
      ids?: string[];
      status?: "pending" | "processed" | "ignored";
      transactionId?: string | null;
    };

    const targetIds = body.ids || (body.id ? [body.id] : []);
    if (targetIds.length === 0 || !body.status) {
      return NextResponse.json(
        {
          ok: false,
          error: "Informe 'id' (ou 'ids') e o novo 'status'.",
        },
        { status: 400 }
      );
    }

    for (const id of targetIds) {
      await client.execute({
        sql: `UPDATE mobile_notifications SET status = ?, transaction_id = COALESCE(?, transaction_id) WHERE id = ?`,
        args: [body.status, body.transactionId ?? null, id],
      });
    }

    return NextResponse.json({
      ok: true,
      updatedCount: targetIds.length,
    });
  } catch (err) {
    console.error("[PATCH /api/notifications] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar status da notificação." },
      { status: 400 }
    );
  }
}
