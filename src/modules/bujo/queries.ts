import { and, asc, desc, eq, gte, inArray, lt, lte, or } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { healthExercises, healthSleeps } from "@/modules/health/schema";
import { getHealthDailySummaryMap } from "@/modules/health/summary";
import { getFinanceDailySummaryMap } from "@/modules/finance/summary";
import { bujoDays, bujoEntityLinks, bujoMonths, bujoTasks } from "./schema";
import {
  buildMonthCalendarGrid,
  computeHeatmapColorAndIntensity,
  getDaysCountInMonth,
  getMonthNamePt,
  getWeekdayForIsoDate,
  nestTasksWithSubtasks,
  resolveHabitBoolean,
  resolveSleepState,
  shiftIsoDate,
  shiftYearMonth,
  WEEKDAY_NAMES_PT,
} from "./bujo-utils";
import type {
  BujoAnnualHeatmapDay,
  BujoAnnualMonthSection,
  BujoAnnualViewData,
  BujoDayViewData,
  BujoMonthDayRow,
  BujoMonthViewData,
} from "./types";

export async function getBujoDayViewData(
  date: string
): Promise<BujoDayViewData> {
  await ensureSchema();

  const prevDate = shiftIsoDate(date, -1);
  const nextDate = shiftIsoDate(date, 1);
  const yearMonth = date.slice(0, 7);
  const year = Number(date.slice(0, 4));
  const rollLookbackStart = shiftIsoDate(date, -45);

  const [
    dayRows,
    taskRows,
    sleepRows,
    exerciseRows,
    linkRows,
    healthSummaryMap,
    financeSummaryMap,
  ] = await Promise.all([
    db
      .select()
      .from(bujoDays)
      .where(inArray(bujoDays.date, [prevDate, date])),
    db
      .select()
      .from(bujoTasks)
      .where(
        or(
          eq(bujoTasks.date, date),
          and(
            eq(bujoTasks.status, "todo"),
            gte(bujoTasks.date, rollLookbackStart),
            lt(bujoTasks.date, date),
            inArray(bujoTasks.source, ["daily", "annual_log"])
          )
        )
      )
      .orderBy(asc(bujoTasks.sortOrder), asc(bujoTasks.createdAt)),
    db
      .select()
      .from(healthSleeps)
      .where(eq(healthSleeps.date, date))
      .orderBy(desc(healthSleeps.endTime)),
    db
      .select()
      .from(healthExercises)
      .where(eq(healthExercises.date, date))
      .orderBy(asc(healthExercises.startTime)),
    db
      .select()
      .from(bujoEntityLinks)
      .where(
        or(
          and(
            eq(bujoEntityLinks.sourceType, "bujo_day"),
            eq(bujoEntityLinks.sourceId, date)
          ),
          eq(bujoEntityLinks.targetSlug, date)
        )
      ),
    getHealthDailySummaryMap(date, date),
    getFinanceDailySummaryMap(date, date),
  ]);

  const currentDay = dayRows.find((d) => d.date === date);
  const previousDay = dayRows.find((d) => d.date === prevDate);

  const hasExplicitYesterday =
    currentDay?.yesterdayNote != null &&
    currentDay.yesterdayNote.trim().length > 0;

  const yesterdayNote = hasExplicitYesterday
    ? currentDay!.yesterdayNote!
    : previousDay?.todayNote ?? "";

  const healthSummary = healthSummaryMap.get(date);
  const financeSummary = financeSummaryMap.get(date) ?? {
    date,
    dailySpent: 0,
    fixedOut: 0,
    income: 0,
    dailyTarget: 50,
    transactionCount: 0,
  };

  const nestedAll = nestTasksWithSubtasks(taskRows);
  const annualCommitments = nestedAll.filter(
    (t) => t.date === date && t.source === "annual_log"
  );
  const dayTasks = nestedAll.filter(
    (t) => t.date === date && t.source === "daily"
  );
  const rolledOverTasks = nestedAll.filter(
    (t) => t.date != null && t.date < date && t.status === "todo"
  );

  const outgoingLinks = linkRows
    .filter((l) => l.sourceType === "bujo_day" && l.sourceId === date)
    .map((l) => ({
      id: l.id,
      sourceType: l.sourceType,
      sourceId: l.sourceId,
      targetRaw: l.targetRaw,
      targetSlug: l.targetSlug,
    }));

  const backlinks = linkRows
    .filter(
      (l) =>
        l.targetSlug === date &&
        !(l.sourceType === "bujo_day" && l.sourceId === date)
    )
    .map((l) => ({
      id: l.id,
      sourceType: l.sourceType,
      sourceId: l.sourceId,
      targetRaw: l.targetRaw,
      targetSlug: l.targetSlug,
    }));

  return {
    date,
    prevDate,
    nextDate,
    yearMonth,
    year,
    yesterdayNote,
    yesterdayNoteFromPreviousDay: !hasExplicitYesterday && Boolean(previousDay?.todayNote),
    todayNote: currentDay?.todayNote ?? "",
    sleep: resolveSleepState(currentDay, healthSummary),
    gym: resolveHabitBoolean(
      currentDay?.gymOverride,
      healthSummary?.didGym ?? false
    ),
    cardio: resolveHabitBoolean(
      currentDay?.cardioOverride,
      healthSummary?.didCardio ?? false
    ),
    vitamin: Boolean(currentDay?.vitamin),
    reading: resolveHabitBoolean(currentDay?.readingOverride, false),
    sleepRecords: sleepRows.map((s) => ({
      uid: s.uid,
      startTime: s.startTime,
      endTime: s.endTime,
      durationMinutes: s.durationMinutes,
      sleepScore: s.sleepScore,
      notes: s.notes ?? null,
      isManualOverride: Boolean(s.isManualOverride),
    })),
    exerciseRecords: exerciseRows.map((e) => ({
      uid: e.uid,
      exerciseType: e.exerciseType,
      startTime: e.startTime,
      endTime: e.endTime,
      durationMinutes: e.durationMinutes,
      caloriesKcal: e.caloriesKcal,
      distanceMeters: e.distanceMeters,
      notes: e.notes ?? null,
      isManualOverride: Boolean(e.isManualOverride),
    })),
    financeSummary,
    annualCommitments,
    rolledOverTasks,
    dayTasks,
    outgoingLinks,
    backlinks,
  };
}

export async function getBujoMonthViewData(
  yearMonth: string
): Promise<BujoMonthViewData> {
  await ensureSchema();

  const [year, monthNumber] = yearMonth.split("-").map(Number);
  const totalDays = getDaysCountInMonth(year, monthNumber);
  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-${String(totalDays).padStart(2, "0")}`;

  const [
    dayRows,
    monthMetaRows,
    taskRows,
    healthSummaryMap,
    financeSummaryMap,
  ] = await Promise.all([
    db
      .select()
      .from(bujoDays)
      .where(and(gte(bujoDays.date, startDate), lte(bujoDays.date, endDate))),
    db
      .select()
      .from(bujoMonths)
      .where(eq(bujoMonths.yearMonth, yearMonth))
      .limit(1),
    db
      .select()
      .from(bujoTasks)
      .where(
        and(
          eq(bujoTasks.year, year),
          or(
            eq(bujoTasks.month, monthNumber),
            and(gte(bujoTasks.date, startDate), lte(bujoTasks.date, endDate))
          )
        )
      )
      .orderBy(asc(bujoTasks.date), asc(bujoTasks.sortOrder), asc(bujoTasks.createdAt)),
    getHealthDailySummaryMap(startDate, endDate),
    getFinanceDailySummaryMap(startDate, endDate),
  ]);

  const dayMap = new Map(dayRows.map((d) => [d.date, d]));
  const nestedTasks = nestTasksWithSubtasks(taskRows);

  const annualCommitments = nestedTasks.filter(
    (t) => t.source === "annual_log"
  );

  const tasksByDate = new Map<string, typeof nestedTasks>();
  for (const t of nestedTasks) {
    if (!t.date) continue;
    const arr = tasksByDate.get(t.date) ?? [];
    arr.push(t);
    tasksByDate.set(t.date, arr);
  }

  const days: BujoMonthDayRow[] = [];
  let sleepMinsSum = 0;
  let sleepMinsCount = 0;
  let sleepScoreSum = 0;
  let sleepScoreCount = 0;
  let gymDays = 0;
  let cardioDays = 0;
  let vitaminDays = 0;
  let readingDays = 0;
  let totalDailySpent = 0;

  for (let d = 1; d <= totalDays; d++) {
    const date = `${yearMonth}-${String(d).padStart(2, "0")}`;
    const bujoDay = dayMap.get(date);
    const health = healthSummaryMap.get(date);
    const finance = financeSummaryMap.get(date);

    const resolvedSleep = resolveSleepState(bujoDay, health);
    const gym = resolveHabitBoolean(
      bujoDay?.gymOverride,
      health?.didGym ?? false
    ).value;
    const cardio = resolveHabitBoolean(
      bujoDay?.cardioOverride,
      health?.didCardio ?? false
    ).value;
    const vitamin = Boolean(bujoDay?.vitamin);
    const reading = resolveHabitBoolean(bujoDay?.readingOverride, false).value;

    const dailySpent = finance?.dailySpent ?? 0;
    const fixedOut = finance?.fixedOut ?? 0;
    const income = finance?.income ?? 0;

    if (resolvedSleep.minutes != null && resolvedSleep.minutes > 0) {
      sleepMinsSum += resolvedSleep.minutes;
      sleepMinsCount++;
    }
    if (resolvedSleep.score != null && resolvedSleep.score > 0) {
      sleepScoreSum += resolvedSleep.score;
      sleepScoreCount++;
    }
    if (gym) gymDays++;
    if (cardio) cardioDays++;
    if (vitamin) vitaminDays++;
    if (reading) readingDays++;
    totalDailySpent = Number((totalDailySpent + dailySpent).toFixed(2));

    const dateTasks = tasksByDate.get(date) ?? [];
    const pendingTasks = dateTasks.filter((t) => t.status === "todo");
    const doneTasksCount = dateTasks.filter((t) => t.status === "done").length;

    days.push({
      date,
      dayNumber: d,
      weekdayShort: WEEKDAY_NAMES_PT[getWeekdayForIsoDate(date)] ?? "",
      sleepMinutes: resolvedSleep.minutes,
      sleepScore: resolvedSleep.score,
      didGym: gym,
      didCardio: cardio,
      didVitamin: vitamin,
      didReading: reading,
      dailySpent,
      fixedOut,
      income,
      hasNote: Boolean(bujoDay?.todayNote && bujoDay.todayNote.trim().length > 0),
      pendingTasks,
      doneTasksCount,
    });
  }

  return {
    yearMonth,
    year,
    monthNumber,
    monthName: getMonthNamePt(monthNumber),
    prevYearMonth: shiftYearMonth(yearMonth, -1),
    nextYearMonth: shiftYearMonth(yearMonth, 1),
    considerationsMarkdown: monthMetaRows[0]?.considerationsMarkdown ?? "",
    calendarWeeks: buildMonthCalendarGrid(yearMonth),
    days,
    annualCommitments,
    stats: {
      avgSleepMinutes:
        sleepMinsCount > 0 ? Math.round(sleepMinsSum / sleepMinsCount) : null,
      avgSleepScore:
        sleepScoreCount > 0
          ? Math.round(sleepScoreSum / sleepScoreCount)
          : null,
      gymDays,
      cardioDays,
      vitaminDays,
      readingDays,
      totalDailySpent,
    },
  };
}

export async function getBujoAnnualViewData(
  year: number
): Promise<BujoAnnualViewData> {
  await ensureSchema();

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const [dayRows, taskRows, healthSummaryMap, financeSummaryMap] =
    await Promise.all([
      db
        .select()
        .from(bujoDays)
        .where(and(gte(bujoDays.date, startDate), lte(bujoDays.date, endDate))),
      db
        .select()
        .from(bujoTasks)
        .where(eq(bujoTasks.year, year))
        .orderBy(asc(bujoTasks.date), asc(bujoTasks.sortOrder), asc(bujoTasks.createdAt)),
      getHealthDailySummaryMap(startDate, endDate),
      getFinanceDailySummaryMap(startDate, endDate),
    ]);

  const dayMap = new Map(dayRows.map((d) => [d.date, d]));
  const nestedTasks = nestTasksWithSubtasks(taskRows);

  const goals = nestedTasks.filter((t) => t.source === "goal");
  const annualCommitments = nestedTasks.filter(
    (t) => t.source === "annual_log"
  );

  const heatmapDays: BujoAnnualHeatmapDay[] = [];
  let daysWithSleep = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let gymDays = 0;
  let cardioDays = 0;
  let vitaminDays = 0;
  let readingDays = 0;

  for (let month = 1; month <= 12; month++) {
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const totalDays = getDaysCountInMonth(year, month);
    for (let day = 1; day <= totalDays; day++) {
      const date = `${ym}-${String(day).padStart(2, "0")}`;
      const bujoDay = dayMap.get(date);
      const health = healthSummaryMap.get(date);
      const finance = financeSummaryMap.get(date);

      const resolvedSleep = resolveSleepState(bujoDay, health);
      const didGym = resolveHabitBoolean(
        bujoDay?.gymOverride,
        health?.didGym ?? false
      ).value;
      const didCardio = resolveHabitBoolean(
        bujoDay?.cardioOverride,
        health?.didCardio ?? false
      ).value;
      const didVitamin = Boolean(bujoDay?.vitamin);
      const didReading = resolveHabitBoolean(
        bujoDay?.readingOverride,
        false
      ).value;
      const { color, intensity } = computeHeatmapColorAndIntensity(
        resolvedSleep.score
      );

      if (resolvedSleep.minutes != null && resolvedSleep.minutes > 0) {
        daysWithSleep++;
      }
      if (resolvedSleep.score != null && resolvedSleep.score > 0) {
        scoreSum += resolvedSleep.score;
        scoreCount++;
      }
      if (didGym) gymDays++;
      if (didCardio) cardioDays++;
      if (didVitamin) vitaminDays++;
      if (didReading) readingDays++;

      heatmapDays.push({
        date,
        month,
        day,
        weekday: getWeekdayForIsoDate(date),
        sleepMinutes: resolvedSleep.minutes,
        sleepScore: resolvedSleep.score,
        didGym,
        didCardio,
        didVitamin,
        didReading,
        dailySpent: finance?.dailySpent ?? 0,
        hasNote: Boolean(
          bujoDay?.todayNote && bujoDay.todayNote.trim().length > 0
        ),
        color,
        intensity,
      });
    }
  }

  const monthlySections: BujoAnnualMonthSection[] = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, "0")}`;
    const commitments = annualCommitments.filter((t) => {
      if (t.month === m) return true;
      if (t.date && t.date.startsWith(ym)) return true;
      return false;
    });
    monthlySections.push({
      monthNumber: m,
      monthName: getMonthNamePt(m),
      yearMonth: ym,
      commitments,
    });
  }

  return {
    year,
    goals,
    heatmapDays,
    monthlySections,
    summary: {
      daysWithSleep,
      avgSleepScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
      gymDays,
      cardioDays,
      vitaminDays,
      readingDays,
    },
  };
}
