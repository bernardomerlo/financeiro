"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { client, db, ensureSchema } from "@/db";
import { bujoDays, bujoEntityLinks, bujoMonths, bujoTasks } from "./schema";
import { extractWikilinks } from "./bujo-utils";
import type { BujoTaskSource, BujoTaskStatus } from "./types";

function revalidateBujoRoutes(date?: string | null) {
  revalidatePath("/");
  revalidatePath("/bujo");
  revalidatePath("/bujo/mes");
  revalidatePath("/bujo/anual");
  if (date) {
    revalidatePath(`/bujo/${date}`);
    revalidatePath(`/bujo/mes/${date.slice(0, 7)}`);
    revalidatePath(`/bujo/anual/${date.slice(0, 4)}`);
  }
}

async function syncEntityLinksForSource(
  sourceType: string,
  sourceId: string,
  markdownText: string
) {
  const now = new Date().toISOString();
  await db
    .delete(bujoEntityLinks)
    .where(
      and(
        eq(bujoEntityLinks.sourceType, sourceType),
        eq(bujoEntityLinks.sourceId, sourceId)
      )
    );

  const links = extractWikilinks(markdownText);
  for (const link of links) {
    await db.insert(bujoEntityLinks).values({
      id: `lnk_${crypto.randomUUID()}`,
      sourceType,
      sourceId,
      targetRaw: link.targetRaw,
      targetSlug: link.targetSlug,
      createdAt: now,
    });
  }
}

export async function saveBujoDayNoteAction(input: {
  date: string;
  todayNote: string;
  yesterdayNote?: string | null;
}) {
  await ensureSchema();
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(bujoDays)
    .where(eq(bujoDays.date, input.date))
    .limit(1);

  if (existing[0]) {
    await client.execute({
      sql: `UPDATE bujo_days
            SET today_note = ?,
                yesterday_note = COALESCE(?, yesterday_note),
                updated_at = ?
            WHERE date = ?`,
      args: [
        input.todayNote,
        input.yesterdayNote !== undefined ? input.yesterdayNote : null,
        now,
        input.date,
      ],
    });
  } else {
    await db.insert(bujoDays).values({
      date: input.date,
      yesterdayNote: input.yesterdayNote ?? null,
      todayNote: input.todayNote,
      vitamin: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  await syncEntityLinksForSource("bujo_day", input.date, input.todayNote);
  revalidateBujoRoutes(input.date);
  return { ok: true };
}

export async function updateBujoDayHabitsAction(input: {
  date: string;
  gymOverride?: number | null;
  cardioOverride?: number | null;
  vitamin?: boolean;
  readingOverride?: number | null;
  sleepMinutesOverride?: number | null;
  sleepScoreOverride?: number | null;
}) {
  await ensureSchema();
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(bujoDays)
    .where(eq(bujoDays.date, input.date))
    .limit(1);

  const current = existing[0];
  const nextGym =
    input.gymOverride !== undefined
      ? input.gymOverride
      : (current?.gymOverride ?? null);
  const nextCardio =
    input.cardioOverride !== undefined
      ? input.cardioOverride
      : (current?.cardioOverride ?? null);
  const nextVitamin =
    input.vitamin !== undefined
      ? input.vitamin
        ? 1
        : 0
      : (current?.vitamin ?? 0);
  const nextReading =
    input.readingOverride !== undefined
      ? input.readingOverride
      : (current?.readingOverride ?? null);
  const nextSleepMin =
    input.sleepMinutesOverride !== undefined
      ? input.sleepMinutesOverride
      : (current?.sleepMinutesOverride ?? null);
  const nextSleepScore =
    input.sleepScoreOverride !== undefined
      ? input.sleepScoreOverride
      : (current?.sleepScoreOverride ?? null);

  if (current) {
    await client.execute({
      sql: `UPDATE bujo_days
            SET gym_override = ?,
                cardio_override = ?,
                vitamin = ?,
                reading_override = ?,
                sleep_minutes_override = ?,
                sleep_score_override = ?,
                updated_at = ?
            WHERE date = ?`,
      args: [
        nextGym,
        nextCardio,
        nextVitamin,
        nextReading,
        nextSleepMin,
        nextSleepScore,
        now,
        input.date,
      ],
    });
  } else {
    await db.insert(bujoDays).values({
      date: input.date,
      yesterdayNote: null,
      todayNote: "",
      gymOverride: nextGym,
      cardioOverride: nextCardio,
      vitamin: nextVitamin,
      readingOverride: nextReading,
      sleepMinutesOverride: nextSleepMin,
      sleepScoreOverride: nextSleepScore,
      createdAt: now,
      updatedAt: now,
    });
  }

  revalidateBujoRoutes(input.date);
  return { ok: true };
}

export async function createBujoTaskAction(input: {
  date?: string | null;
  year?: number;
  month?: number | null;
  parentId?: string | null;
  title: string;
  url?: string | null;
  source?: BujoTaskSource;
}) {
  await ensureSchema();
  const cleanTitle = input.title.trim();
  if (!cleanTitle) {
    throw new Error("Informe o título da tarefa.");
  }

  const now = new Date().toISOString();
  const dateStr = input.date && input.date.trim() ? input.date.trim() : null;
  const resolvedYear =
    input.year ??
    (dateStr ? Number(dateStr.slice(0, 4)) : new Date().getFullYear());
  const resolvedMonth =
    input.month ?? (dateStr ? Number(dateStr.slice(5, 7)) : null);

  const id = `btask_${crypto.randomUUID()}`;
  await db.insert(bujoTasks).values({
    id,
    date: dateStr,
    year: resolvedYear,
    month: resolvedMonth,
    parentId: input.parentId ?? null,
    title: cleanTitle,
    url: input.url?.trim() || null,
    status: "todo",
    source: input.source ?? "daily",
    sortOrder: Date.now(),
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  if (dateStr) {
    const links = extractWikilinks(cleanTitle);
    for (const link of links) {
      await db.insert(bujoEntityLinks).values({
        id: `lnk_${crypto.randomUUID()}`,
        sourceType: "bujo_day",
        sourceId: dateStr,
        targetRaw: link.targetRaw,
        targetSlug: link.targetSlug,
        createdAt: now,
      });
    }
  }

  revalidateBujoRoutes(dateStr);
  return { ok: true, id };
}

export async function toggleBujoTaskStatusAction(input: {
  id: string;
  status: BujoTaskStatus;
}) {
  await ensureSchema();
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(bujoTasks)
    .where(eq(bujoTasks.id, input.id))
    .limit(1);

  const completedAt = input.status === "done" ? now : null;
  await client.execute({
    sql: `UPDATE bujo_tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
    args: [input.status, completedAt, now, input.id],
  });

  revalidateBujoRoutes(existing[0]?.date);
  return { ok: true };
}

export async function updateBujoTaskAction(input: {
  id: string;
  title: string;
  date?: string | null;
  url?: string | null;
}) {
  await ensureSchema();
  const cleanTitle = input.title.trim();
  if (!cleanTitle) {
    throw new Error("O título da tarefa não pode ficar vazio.");
  }

  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(bujoTasks)
    .where(eq(bujoTasks.id, input.id))
    .limit(1);

  const nextDate =
    input.date !== undefined ? input.date : (existing[0]?.date ?? null);
  const nextMonth = nextDate ? Number(nextDate.slice(5, 7)) : existing[0]?.month ?? null;
  const nextYear = nextDate ? Number(nextDate.slice(0, 4)) : existing[0]?.year ?? new Date().getFullYear();

  await client.execute({
    sql: `UPDATE bujo_tasks
          SET title = ?, date = ?, month = ?, year = ?, url = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      cleanTitle,
      nextDate,
      nextMonth,
      nextYear,
      input.url !== undefined ? input.url?.trim() || null : (existing[0]?.url ?? null),
      now,
      input.id,
    ],
  });

  revalidateBujoRoutes(existing[0]?.date);
  if (nextDate && nextDate !== existing[0]?.date) {
    revalidateBujoRoutes(nextDate);
  }
  return { ok: true };
}

export async function migrateBujoTaskToDateAction(input: {
  id: string;
  targetDate: string;
}) {
  await ensureSchema();
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(bujoTasks)
    .where(eq(bujoTasks.id, input.id))
    .limit(1);

  const targetYear = Number(input.targetDate.slice(0, 4));
  const targetMonth = Number(input.targetDate.slice(5, 7));

  await client.execute({
    sql: `UPDATE bujo_tasks
          SET date = ?, year = ?, month = ?, updated_at = ?
          WHERE id = ? OR parent_id = ?`,
    args: [input.targetDate, targetYear, targetMonth, now, input.id, input.id],
  });

  revalidateBujoRoutes(existing[0]?.date);
  revalidateBujoRoutes(input.targetDate);
  return { ok: true };
}

export async function deleteBujoTaskAction(id: string) {
  await ensureSchema();
  const existing = await db
    .select()
    .from(bujoTasks)
    .where(eq(bujoTasks.id, id))
    .limit(1);

  await db.delete(bujoTasks).where(eq(bujoTasks.parentId, id));
  await db.delete(bujoTasks).where(eq(bujoTasks.id, id));

  revalidateBujoRoutes(existing[0]?.date);
  return { ok: true };
}

export async function saveBujoMonthConsiderationsAction(input: {
  yearMonth: string;
  considerationsMarkdown: string;
}) {
  await ensureSchema();
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT OR REPLACE INTO bujo_months (year_month, considerations_markdown, updated_at)
          VALUES (?, ?, ?)`,
    args: [input.yearMonth, input.considerationsMarkdown, now],
  });
  revalidateBujoRoutes(`${input.yearMonth}-01`);
  return { ok: true };
}
